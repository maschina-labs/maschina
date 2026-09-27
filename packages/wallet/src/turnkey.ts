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
import { tokenAccountFor, WRAPPED_SOL } from "@maschina/solana";
import {
	type SolanaAddress,
	validatePolicy,
	validateRecipients,
	type WalletPolicy,
} from "./policy.ts";
import { type PolicySpec, policyFromExpressions, turnkeyPolicies } from "./turnkey-policy.ts";
import {
	type ProviderError,
	providerError,
	type WalletAccount,
	type WalletProvider,
} from "./wallet-provider.ts";

/** A machine's trading account, in Turnkey's words. Every wallet made before vaults has only this one. */
export const SOLANA_ACCOUNT = {
	curve: "CURVE_ED25519",
	pathFormat: "PATH_FORMAT_BIP32",
	path: "m/44'/501'/0'/0'",
	addressFormat: "ADDRESS_FORMAT_SOLANA",
} as const;

/**
 * A machine's vault: the next account under the same key.
 *
 * Same key, different account, different policy. Turnkey enforces policy per account address, so the
 * vault's key is technically the machine's key and still cannot sign anything the vault's policy does not
 * allow. That is the point: the separation holds at the provider, not in a column.
 */
export const SOLANA_VAULT_ACCOUNT = { ...SOLANA_ACCOUNT, path: "m/44'/501'/1'/0'" } as const;

const PATHS: Record<WalletAccount, string> = {
	trading: SOLANA_ACCOUNT.path,
	vault: SOLANA_VAULT_ACCOUNT.path,
};

/** The part of Turnkey's API this adapter uses, and nothing more. */
export type TurnkeyApi = {
	createWallet(body: {
		walletName: string;
		accounts: (typeof SOLANA_ACCOUNT | typeof SOLANA_VAULT_ACCOUNT)[];
	}): Promise<{ walletId: string; addresses: string[] }>;
	getWalletAccounts(body: {
		walletId: string;
	}): Promise<{ accounts: { address: string; addressFormat: string; path: string }[] }>;
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

/**
 * One account's address, found by its derivation path rather than its position.
 *
 * Turnkey lists accounts in the order they were made, but order is an accident and the path is a fact.
 * Picking the vault by position would put a trading key where a vault key was meant, silently.
 */
const solanaAddressOf = (
	accounts: { address: string; addressFormat: string; path: string }[],
	account: WalletAccount,
) =>
	accounts.find(
		(found) =>
			found.addressFormat === SOLANA_ACCOUNT.addressFormat && found.path === PATHS[account],
	)?.address;

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

	/**
	 * What Turnkey is enforcing on one account, read out of its own stored expressions.
	 *
	 * The wrap account is derived here, from the address, rather than taken from anything stored. That
	 * way a policy can only ever be read as wrapping SOL into the wallet's own account.
	 */
	async function storedPolicy(
		walletAddress: string,
	): Promise<{ policy: WalletPolicy | undefined; rows: StoredPolicy[] }> {
		const rows = await policiesFor(walletAddress);
		const wrapAccount = await wrapAccountOf(walletAddress);
		const policy = policyFromExpressions(
			rows.map((row) => ({
				policyName: row.policyName,
				effect: row.effect as PolicySpec["effect"],
				consensus: row.consensus,
				condition: row.condition,
				notes: "",
			})),
			{ wrapAccount },
		);
		return { policy, rows };
	}

	async function addressOf(
		walletId: string,
		account: WalletAccount = "trading",
	): Promise<string | undefined> {
		const { accounts } = await admin.getWalletAccounts({ walletId });
		return solanaAddressOf(accounts, account);
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
				wrapAccount: await wrapAccountOf(walletAddress),
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
		const { policy: readBack, rows: stored } = await storedPolicy(walletAddress);

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

		async createWallet({ label, policy, vault }) {
			const checked = validatePolicy(policy);
			if (!checked.ok) return err(checked.error);
			// Both policies are checked before anything is made, so a bad vault never leaves a trading
			// account behind with nothing beside it.
			const checkedVault = vault === undefined ? undefined : validatePolicy(vault);
			if (checkedVault && !checkedVault.ok) return err(checkedVault.error);

			try {
				const created = await admin.createWallet({
					walletName: label,
					accounts: checkedVault ? [SOLANA_ACCOUNT, SOLANA_VAULT_ACCOUNT] : [SOLANA_ACCOUNT],
				});

				// Looked up by path, never taken from the order Turnkey happened to answer in.
				const address = await addressOf(created.walletId, "trading");
				if (!address) {
					return err(
						providerError("unexpected", "turnkey created a wallet with no Solana address", {
							walletId: created.walletId,
						}),
					);
				}

				const applied = await applyPolicies(address, checked.value);
				if (!applied.ok) return applied;
				if (!checkedVault) return ok({ walletId: created.walletId, address });

				const vaultAddress = await addressOf(created.walletId, "vault");
				if (!vaultAddress) {
					return err(
						providerError("unexpected", "turnkey created a wallet with no vault account", {
							walletId: created.walletId,
						}),
					);
				}
				const appliedVault = await applyPolicies(vaultAddress, checkedVault.value);
				if (!appliedVault.ok) return appliedVault;

				return ok({ walletId: created.walletId, address, vaultAddress });
			} catch (error) {
				return err(classifyTurnkeyError(error, "creating a wallet"));
			}
		},

		async readPolicy(walletId, account = "trading") {
			try {
				const address = await addressOf(walletId, account);
				if (!address) return err(providerError("not_found", "no such wallet", { walletId }));

				const { policy } = await storedPolicy(address);

				return policy
					? ok(policy)
					: err(providerError("not_found", "this wallet has no policy", { walletId }));
			} catch (error) {
				return err(classifyTurnkeyError(error, "reading a policy"));
			}
		},

		async sign(walletId, unsignedTransaction, account = "trading") {
			if (unsignedTransaction.length === 0) {
				return err(providerError("invalid", "there is nothing to sign", { walletId }));
			}

			try {
				const address = await addressOf(walletId, account);
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

				const { policy: current } = await storedPolicy(address);
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

/** The wallet's own wrapped SOL account: where a sale wraps SOL, and nowhere else. */
const wrapAccountOf = (walletAddress: string): Promise<string> =>
	tokenAccountFor({ owner: walletAddress, mint: WRAPPED_SOL });
