/**
 * Creates the spike's Crossmint wallet on Solana (#21). The recovery signer is a server signer: a secret
 * that stays on Maschina's side, from which the SDK derives the signing key. The secret is saved before
 * the wallet exists, so a wallet is never created with a key nobody kept.
 */

import { randomBytes } from "node:crypto";

/** The part of Crossmint's wallets SDK the setup uses. */
export type CrossmintWalletsApi = {
	createWallet(args: {
		chain: "solana";
		recovery: { type: "server"; secret: string };
		alias: string;
	}): Promise<{ address: string }>;
	getWallet(locator: string, args: { chain: "solana" }): Promise<{ address: string }>;
};

export type CrossmintSetupResult =
	| { address: string; created: true; createMs: number }
	| {
			address: string;
			created: false;
	  };

/** A Crossmint server signer secret: `xmsk1_` and 32 random bytes as hex. */
export const newServerSecret = () => `xmsk1_${randomBytes(32).toString("hex")}`;

export async function setupCrossmintWallet(options: {
	wallets: CrossmintWalletsApi;
	label: string;
	savedSecret: string | undefined;
	/** The address from an earlier run, if any. */
	savedAddress: string | undefined;
	storeSecret: (secret: string) => Promise<void>;
	newSecret?: () => string;
	now?: () => number;
}): Promise<CrossmintSetupResult> {
	const { wallets, savedSecret, savedAddress } = options;
	const now = options.now ?? (() => performance.now());

	if (savedAddress) {
		if (!savedSecret) {
			throw new Error(
				`A wallet exists at ${savedAddress}, but its secret is missing from Infisical.`,
			);
		}
		const found = await wallets.getWallet(savedAddress, { chain: "solana" });
		if (found.address !== savedAddress) {
			throw new Error(
				`The wallet Crossmint returned (${found.address}) doesn't match ${savedAddress}.`,
			);
		}
		return { address: savedAddress, created: false };
	}

	let secret = savedSecret;
	if (!secret) {
		secret = (options.newSecret ?? newServerSecret)();
		await options.storeSecret(secret);
	}
	const started = now();
	const wallet = await wallets.createWallet({
		chain: "solana",
		recovery: { type: "server", secret },
		alias: `spike-machine-${options.label}`,
	});
	return { address: wallet.address, created: true, createMs: now() - started };
}
