/**
 * Turnkey, as a wallet provider (D-064).
 *
 * Turnkey holds the key and enforces the wallet's policy. Maschina never sees a private key and there is
 * no method here that could ask for one: the wallet's own policies deny export to the signer, and that
 * denial is written at the same moment the wallet is created.
 *
 * Two habits run through this file, and both are about not trusting our own intentions:
 *
 *   - **A policy is never assumed to be in place.** Whatever is asked for is read back out of Turnkey's
 *     own stored policies and compared before a wallet is reported as created. A wallet whose policy
 *     did not stick is worse than no wallet, because it looks finished.
 *   - **A refusal is not a failure.** Turnkey turning a transaction down is the system working, and it
 *     comes back as `refused`, which nothing retries. A network problem comes back as `unavailable`,
 *     which is retried. Telling those apart is the difference between a machine that stops when it
 *     should and one that hammers a provider that has already said no.
 */

import { err, ok, type Result } from "@maschina/core";
import {
	type SolanaAddress,
	validatePolicy,
	validateRecipients,
	type WalletPolicy,
} from "./policy.ts";
import { type PolicySpec, policyFromExpressions, turnkeyPolicies } from "./turnkey-policy.ts";
import { type ProviderError, providerError, type WalletProvider } from "./wallet-provider.ts";

/** A Solana account, in Turnkey's words. */
export const SOLANA_ACCOUNT = {
	curve: "CURVE_ED25519",
	pathFormat: "PATH_FORMAT_BIP32",
	path: "m/44'/501'/0'/0'",
	addressFormat: "ADDRESS_FORMAT_SOLANA",
} as const;

/** The part of Turnkey's API this adapter uses, and nothing more. */
export type TurnkeyApi = {
	createWallet(body: {
		walletName: string;
		accounts: (typeof SOLANA_ACCOUNT)[];
	}): Promise<{ walletId: string; addresses: string[] }>;
	getWalletAccounts(body: {
		walletId: string;
	}): Promise<{ accounts: { address: string; addressFormat: string }[] }>;
	getPolicies(): Promise<{ policies: StoredPolicy[] }>;
	createPolicy(body: {
		policyName: string;
		effect: PolicySpec["effect"];
		consensus: string;
		condition: string;
		notes: string;
	}): Promise<{ policyId: string }>;
	updatePolicy(body: {
		policyId: string;
		policyName: string;
		policyEffect: PolicySpec["effect"];
		policyConsensus: string;
		policyCondition: string;
		policyNotes: string;
	}): Promise<unknown>;
	signTransaction(body: {
		signWith: string;
		unsignedTransaction: string;
		type: "TRANSACTION_TYPE_SOLANA";
	}): Promise<{ signedTransaction: string }>;
};

export type StoredPolicy = {
	policyId: string;
	policyName: string;
	effect: string;
	consensus: string;
	condition: string;
};

export type TurnkeyOptions = {
	/**
	 * The key that may create wallets and write policies. It never signs a machine's transaction.
	 *
	 * Turnkey itself enforces this split: the signer's key has no permission to create a wallet, which is
	 * how it should be. Creating a machine wallet is an administrative act that happens when a machine is
	 * made; signing is what the running system does all day. Giving one key both powers would mean the
	 * key that signs every trade could also write its own policy.
	 */
	admin: TurnkeyApi;
	/** The key that signs for machine wallets, and can do nothing else. Never a root key. */
	signer: TurnkeyApi;
	/** The Turnkey user that key belongs to, which the wallet's policy names as its only approver. */
	signerUserId: string;
};

/** Turnkey's own words for "the policy said no", which is never retried. */
const REFUSAL =
	/policy|consensus|not authorized|unauthorized|forbidden|permission|rejected|denied/i;
/** Words for "ask again later". */
const UNAVAILABLE =
	/timeout|timed out|etimedout|econn|socket|network|fetch failed|502|503|504|429|rate limit/i;
const MISSING = /not found|does not exist|no such/i;

const messageOf = (error: unknown): string =>
	error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);

/** Turns whatever Turnkey threw into one of the five kinds the signer knows how to act on. */
export function classifyTurnkeyError(error: unknown, doing: string): ProviderError {
	const text = messageOf(error);

	if (REFUSAL.test(text)) {
		return providerError("refused", `turnkey refused: ${text}`, { doing }, error);
	}
	if (UNAVAILABLE.test(text)) {
		return providerError("unavailable", `turnkey is unavailable: ${text}`, { doing }, error);
	}
	if (MISSING.test(text)) {
		return providerError("not_found", text, { doing }, error);
	}
	// Anything unrecognised is a bug until somebody has read it. It is never retried, and never
	// mistaken for a refusal, because a refusal is a decision and this is an unknown.
	return providerError("unexpected", `turnkey failed while ${doing}: ${text}`, { doing }, error);
}

const solanaAddressOf = (accounts: { address: string; addressFormat: string }[]) =>
	accounts.find((account) => account.addressFormat === SOLANA_ACCOUNT.addressFormat)?.address;

/** Turnkey policy names are made from the wallet address, so a wallet's policies can always be found. */
const labelFor = (walletAddress: string) => `w-${walletAddress.slice(0, 12).toLowerCase()}`;

export function turnkeyProvider(options: TurnkeyOptions): WalletProvider {
	const { admin, signer, signerUserId } = options;

	/** Every policy Turnkey holds for one wallet, by the naming convention. */
	async function policiesFor(walletAddress: string): Promise<StoredPolicy[]> {
		const { policies } = await admin.getPolicies();
		const prefix = `machine:${labelFor(walletAddress)}:`;
		return policies.filter((policy) => policy.policyName.startsWith(prefix));
	}

	async function addressOf(walletId: string): Promise<string | undefined> {
		const { accounts } = await admin.getWalletAccounts({ walletId });
		return solanaAddressOf(accounts);
	}

	/** Writes the policies for a wallet, updating any that already exist, then reads them back. */
	async function applyPolicies(
		walletAddress: string,
		policy: WalletPolicy,
	): Promise<Result<WalletPolicy, ProviderError>> {
		let wanted: PolicySpec[];
		try {
			wanted = turnkeyPolicies({
				label: labelFor(walletAddress),
				signerUserId,
				walletAddress,
				policy,
			});
		} catch (error) {
			return err(providerError("invalid", messageOf(error), { walletAddress }, error));
		}

		const existing = await policiesFor(walletAddress);

		for (const spec of wanted) {
			const already = existing.find((stored) => stored.policyName === spec.policyName);
			if (!already) {
				await admin.createPolicy(spec);
				continue;
			}
			if (
				already.effect === spec.effect &&
				already.consensus === spec.consensus &&
				already.condition === spec.condition
			) {
				continue;
			}
			await admin.updatePolicy({
				policyId: already.policyId,
				policyName: spec.policyName,
				policyEffect: spec.effect,
				policyConsensus: spec.consensus,
				policyCondition: spec.condition,
				policyNotes: spec.notes,
			});
		}

		// Read back from Turnkey rather than trusting what was just sent. This is the only evidence that
		// the policy is actually in force.
		const stored = await policiesFor(walletAddress);
		const readBack = policyFromExpressions(
			stored.map((policyRow) => ({
				policyName: policyRow.policyName,
				effect: policyRow.effect as PolicySpec["effect"],
				consensus: policyRow.consensus,
				condition: policyRow.condition,
				notes: "",
			})),
		);

		if (!readBack) {
			return err(
				providerError("unexpected", "the wallet's policy is not in place after writing it", {
					walletAddress,
				}),
			);
		}

		const denies = stored.some(
			(policyRow) =>
				policyRow.policyName.endsWith(":no-export") && policyRow.effect === "EFFECT_DENY",
		);
		if (!denies) {
			// A wallet whose key could be exported is not a machine wallet, whatever else is in place.
			return err(
				providerError("unexpected", "the wallet does not deny key export", { walletAddress }),
			);
		}

		return ok(readBack);
	}

	return {
		name: "turnkey",

		async createWallet({ label, policy }) {
			const checked = validatePolicy(policy);
			if (!checked.ok) return err(checked.error);

			try {
				const created = await admin.createWallet({
					walletName: label,
					accounts: [SOLANA_ACCOUNT],
				});

				const address = created.addresses[0] ?? (await addressOf(created.walletId));
				if (!address) {
					return err(
						providerError("unexpected", "turnkey created a wallet with no Solana address", {
							walletId: created.walletId,
						}),
					);
				}

				const applied = await applyPolicies(address, checked.value);
				if (!applied.ok) return applied;

				return ok({ walletId: created.walletId, address });
			} catch (error) {
				return err(classifyTurnkeyError(error, "creating a wallet"));
			}
		},

		async readPolicy(walletId) {
			try {
				const address = await addressOf(walletId);
				if (!address) return err(providerError("not_found", "no such wallet", { walletId }));

				const stored = await policiesFor(address);
				const policy = policyFromExpressions(
					stored.map((policyRow) => ({
						policyName: policyRow.policyName,
						effect: policyRow.effect as PolicySpec["effect"],
						consensus: policyRow.consensus,
						condition: policyRow.condition,
						notes: "",
					})),
				);

				return policy
					? ok(policy)
					: err(providerError("not_found", "this wallet has no policy", { walletId }));
			} catch (error) {
				return err(classifyTurnkeyError(error, "reading a policy"));
			}
		},

		async sign(walletId, unsignedTransaction) {
			if (unsignedTransaction.length === 0) {
				return err(providerError("invalid", "there is nothing to sign", { walletId }));
			}

			try {
				const address = await addressOf(walletId);
				if (!address) return err(providerError("not_found", "no such wallet", { walletId }));

				const signed = await signer.signTransaction({
					signWith: address,
					unsignedTransaction: Buffer.from(unsignedTransaction).toString("hex"),
					type: "TRANSACTION_TYPE_SOLANA",
				});

				if (!signed.signedTransaction) {
					return err(providerError("unexpected", "turnkey returned no transaction", { walletId }));
				}
				return ok(new Uint8Array(Buffer.from(signed.signedTransaction, "hex")));
			} catch (error) {
				return err(classifyTurnkeyError(error, "signing"));
			}
		},

		async setRecipients(walletId, recipients) {
			try {
				const address = await addressOf(walletId);
				if (!address) return err(providerError("not_found", "no such wallet", { walletId }));

				const stored = await policiesFor(address);
				const current = policyFromExpressions(
					stored.map((policyRow) => ({
						policyName: policyRow.policyName,
						effect: policyRow.effect as PolicySpec["effect"],
						consensus: policyRow.consensus,
						condition: policyRow.condition,
						notes: "",
					})),
				);
				if (!current) {
					return err(providerError("not_found", "this wallet has no policy", { walletId }));
				}

				const checked = validateRecipients(current.owner, recipients as readonly SolanaAddress[]);
				if (!checked.ok) return err(checked.error);

				return applyPolicies(address, { ...current, recipients: checked.value });
			} catch (error) {
				return err(classifyTurnkeyError(error, "setting recipients"));
			}
		},
	};
}
