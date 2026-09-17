/**
 * Sets up one machine wallet in Turnkey: a non-root signer user, a Solana wallet, and the policies that
 * limit what the signer can do with it. Safe to run again: it only creates or fixes what's missing or
 * different, then reads every policy back to confirm it matches.
 */

import { type ApiKeyPair, generateApiKeyPair } from "../api-key.ts";
import { type MachineWalletRules, machineWalletPolicies, type PolicySpec } from "../policy.ts";

export const SIGNER_USER = "spike-signer";

const SOLANA_ACCOUNT = {
	curve: "CURVE_ED25519",
	pathFormat: "PATH_FORMAT_BIP32",
	path: "m/44'/501'/0'/0'",
	addressFormat: "ADDRESS_FORMAT_SOLANA",
} as const;

type Effect = PolicySpec["effect"];

/** The part of Turnkey's API the setup uses, so tests can stand in for it. */
export type TurnkeyAdmin = {
	getUsers(): Promise<{
		users: { userId: string; userName: string; apiKeys: { credential: { publicKey: string } }[] }[];
	}>;
	createUsers(body: {
		users: {
			userName: string;
			apiKeys: { apiKeyName: string; publicKey: string; curveType: "API_KEY_CURVE_P256" }[];
			authenticators: [];
			oauthProviders: [];
			userTags: [];
		}[];
	}): Promise<{ userIds: string[] }>;
	getWallets(): Promise<{ wallets: { walletId: string; walletName: string }[] }>;
	createWallet(body: {
		walletName: string;
		accounts: (typeof SOLANA_ACCOUNT)[];
	}): Promise<{ walletId: string; addresses: string[] }>;
	getWalletAccounts(body: {
		walletId: string;
	}): Promise<{ accounts: { address: string; addressFormat: string }[] }>;
	getPolicies(): Promise<{
		policies: {
			policyId: string;
			policyName: string;
			effect: string;
			consensus: string;
			condition: string;
		}[];
	}>;
	createPolicy(body: {
		policyName: string;
		effect: Effect;
		consensus: string;
		condition: string;
		notes: string;
	}): Promise<{ policyId: string }>;
	updatePolicy(body: {
		policyId: string;
		policyName: string;
		policyEffect: Effect;
		policyConsensus: string;
		policyCondition: string;
		policyNotes: string;
	}): Promise<unknown>;
};

export type SetupOptions = {
	admin: TurnkeyAdmin;
	label: string;
	ownerAddress: string;
	/** The signer's public key already saved in the secrets manager, if any. */
	signerPublicKey: string | undefined;
	/** Saves a new signer key pair. Runs before the user is created, so a key is never lost. */
	storeSigner: (keys: ApiKeyPair) => Promise<void>;
	newKeyPair?: () => ApiKeyPair;
	settings: Pick<
		MachineWalletRules,
		"approvedPrograms" | "approvedMints" | "maxLamportsPerTransfer"
	>;
};

export type SetupResult = {
	signerUserId: string;
	walletId: string;
	walletAddress: string;
	/** What this run created or fixed. Empty when everything was already in place. */
	changed: string[];
};

const same = (a: { effect: string; consensus: string; condition: string }, b: PolicySpec) =>
	a.effect === b.effect && a.consensus === b.consensus && a.condition === b.condition;

export async function setupMachineWallet(options: SetupOptions): Promise<SetupResult> {
	const { admin, label } = options;
	const changed: string[] = [];

	// The signer: a user without root powers, so the policies apply to it.
	const { users } = await admin.getUsers();
	const existing = users.find((user) => user.userName === SIGNER_USER);
	let signerUserId: string;
	if (existing) {
		const known = existing.apiKeys.some(
			(key) => key.credential.publicKey === options.signerPublicKey,
		);
		if (!known) {
			throw new Error(
				`${SIGNER_USER} already exists, but its key isn't the one saved. Delete the user in Turnkey and run this again.`,
			);
		}
		signerUserId = existing.userId;
	} else {
		const keys = (options.newKeyPair ?? generateApiKeyPair)();
		await options.storeSigner(keys);
		const created = await admin.createUsers({
			users: [
				{
					userName: SIGNER_USER,
					apiKeys: [
						{ apiKeyName: SIGNER_USER, publicKey: keys.publicKey, curveType: "API_KEY_CURVE_P256" },
					],
					authenticators: [],
					oauthProviders: [],
					userTags: [],
				},
			],
		});
		const id = created.userIds[0];
		if (!id) throw new Error("Turnkey didn't return the new user's id");
		signerUserId = id;
		changed.push("signer");
	}

	// The wallet, with one Solana account.
	const walletName = `spike-machine-${label}`;
	const { wallets } = await admin.getWallets();
	let walletId = wallets.find((wallet) => wallet.walletName === walletName)?.walletId;
	let walletAddress: string | undefined;
	if (walletId) {
		const { accounts } = await admin.getWalletAccounts({ walletId });
		walletAddress = accounts.find(
			(account) => account.addressFormat === SOLANA_ACCOUNT.addressFormat,
		)?.address;
	} else {
		const created = await admin.createWallet({ walletName, accounts: [SOLANA_ACCOUNT] });
		walletId = created.walletId;
		walletAddress = created.addresses[0];
		changed.push("wallet");
	}
	if (!walletAddress) throw new Error(`${walletName} has no Solana account`);

	// The policies.
	const specs = machineWalletPolicies(label, {
		...options.settings,
		signerUserId,
		walletAddress,
		transferRecipients: [options.ownerAddress],
	});
	const { policies } = await admin.getPolicies();
	for (const spec of specs) {
		const current = policies.find((policy) => policy.policyName === spec.policyName);
		if (!current) {
			await admin.createPolicy(spec);
			changed.push(spec.policyName);
		} else if (!same(current, spec)) {
			await admin.updatePolicy({
				policyId: current.policyId,
				policyName: spec.policyName,
				policyEffect: spec.effect,
				policyConsensus: spec.consensus,
				policyCondition: spec.condition,
				policyNotes: spec.notes,
			});
			changed.push(spec.policyName);
		}
	}

	// Read everything back. What Turnkey stored is what counts.
	const { policies: stored } = await admin.getPolicies();
	for (const spec of specs) {
		const saved = stored.find((policy) => policy.policyName === spec.policyName);
		if (!saved || !same(saved, spec))
			throw new Error(`${spec.policyName} doesn't match what was set`);
	}

	return { signerUserId, walletId, walletAddress, changed };
}
