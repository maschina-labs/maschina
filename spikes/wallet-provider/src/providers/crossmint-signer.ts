/**
 * The machine's signer on a Crossmint wallet (#22): a keypair Maschina holds, registered as a delegated
 * signer and limited with Crossmint's scopes.
 *
 * Crossmint's scopes cover transfers only: which token, to whom, and how much per interval. Crossmint's
 * backend checks them before broadcasting. Rules they can't express are listed below, so the comparison
 * with Turnkey states them rather than hiding them.
 */

import { Keypair } from "@solana/web3.js";

export type Scope = {
	type: "transfer";
	tokenLocator: string;
	recipients?: string[];
	spendingLimit?: { amount: string; interval?: number };
};

export const UNEXPRESSIBLE_RULES = [
	{
		rule: "approved programs",
		why: "Scopes only describe transfers. Nothing limits which programs a transaction may call.",
	},
	{
		rule: "size of a single transaction",
		why: "A spending limit is a total per interval, not a cap on each transaction.",
	},
] as const;

export function machineScopes(options: {
	owner: string;
	solLimit: string;
	intervalSeconds: number;
	/** More addresses SOL may go to, such as the wallet's own wrapped SOL account. */
	extraSolRecipients?: string[];
	/**
	 * Tokens the machine may send, each with its allowed recipients. For tokens Crossmint checks the
	 * destination token account, not the wallet that owns it.
	 */
	tokens?: { mint: string; recipients: string[] }[];
}): Scope[] {
	return [
		{
			type: "transfer",
			tokenLocator: "solana:sol",
			recipients: [options.owner, ...(options.extraSolRecipients ?? [])],
			spendingLimit: { amount: options.solLimit, interval: options.intervalSeconds },
		},
		...(options.tokens ?? []).map(
			(token): Scope => ({
				type: "transfer",
				tokenLocator: `solana:${token.mint}`,
				recipients: token.recipients,
			}),
		),
	];
}

const normal = (scopes: Scope[]) =>
	scopes
		.map((scope) =>
			JSON.stringify({
				token: scope.tokenLocator,
				recipients: [...(scope.recipients ?? [])].sort(),
				amount: scope.spendingLimit ? Number(scope.spendingLimit.amount) : null,
				interval: scope.spendingLimit?.interval ?? null,
			}),
		)
		.sort();

/** True when two scope lists allow exactly the same transfers. */
export function sameScopes(a: Scope[] | undefined, b: Scope[]): boolean {
	if (!a) return false;
	return JSON.stringify(normal(a)) === JSON.stringify(normal(b));
}

/** The parts of Crossmint's wallet the setup uses. */
export type CrossmintSignerApi = {
	/** Acts as the wallet's server (admin) signer, which approves signer changes. */
	useServerSigner(): Promise<void>;
	signers(): Promise<
		{ type: string; address?: string; locator: string; status: string; scopes?: Scope[] }[]
	>;
	addSigner(address: string, scopes: Scope[]): Promise<void>;
	removeSigner(address: string): Promise<void>;
};

export type MachineSigner = { address: string; secretHex: string };

export const newMachineSigner = (): MachineSigner => {
	const keypair = Keypair.generate();
	return {
		address: keypair.publicKey.toBase58(),
		secretHex: Buffer.from(keypair.secretKey).toString("hex"),
	};
};

export async function setupMachineSigner(options: {
	api: CrossmintSignerApi;
	scopes: Scope[];
	saved: MachineSigner | undefined;
	storeSecret: (signer: MachineSigner) => Promise<void>;
	newSigner?: () => MachineSigner;
}): Promise<{ address: string; changed: string[] }> {
	const { api, scopes } = options;
	const changed: string[] = [];

	let signer = options.saved;
	if (!signer) {
		signer = (options.newSigner ?? newMachineSigner)();
		await options.storeSecret(signer);
	}

	const current = (await api.signers()).find((s) => s.address === signer.address);
	if (!current) {
		await api.useServerSigner();
		await api.addSigner(signer.address, scopes);
		changed.push("signer");
	} else if (!sameScopes(current.scopes, scopes)) {
		await api.useServerSigner();
		await api.removeSigner(signer.address);
		await api.addSigner(signer.address, scopes);
		changed.push("scopes");
	}

	if (changed.length > 0) {
		const stored = (await api.signers()).find((s) => s.address === signer.address);
		if (!stored || !sameScopes(stored.scopes, scopes)) {
			throw new Error(
				`The signer's scopes don't match what was set: ${JSON.stringify(stored?.scopes)}`,
			);
		}
	}
	return { address: signer.address, changed };
}
