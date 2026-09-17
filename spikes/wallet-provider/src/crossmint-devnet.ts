/**
 * The spike's Crossmint wallet and scoped machine signer on devnet, set up the same way wherever it's
 * needed: by `pnpm setup:crossmint`, and by the recipient checks, which add a recipient and take it away
 * again.
 */

import { CrossmintWallets, createCrossmint, SolanaWallet } from "@crossmint/wallets-sdk";
import { address } from "@solana/kit";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { crossmintEnv, crossmintMachineSigner, crossmintSignerSecret, setupEnv } from "./env.ts";
import { readJsonIfPresent } from "./files.ts";
import { storeInInfisical } from "./infisical.ts";
import { type CrossmintWalletsApi, setupCrossmintWallet } from "./providers/crossmint-setup.ts";
import {
	type CrossmintSignerApi,
	machineScopes,
	type Scope,
	setupMachineSigner,
} from "./providers/crossmint-signer.ts";
import { WRAPPED_SOL, wrappedSolAccount } from "./solana/transactions.ts";

export const CROSSMINT_SETUP_RESULT = "results/crossmint-setup-devnet.json";

/**
 * Creates or finds the wallet and its machine signer, and makes the signer's scopes match. `recipients`
 * may receive SOL as well as the owner. Changing them replaces the signer's scopes, not the wallet.
 */
export async function applyCrossmintSetup(env: NodeJS.ProcessEnv, recipients: string[] = []) {
	const cm = crossmintEnv(env);
	const { ownerAddress } = setupEnv(env);
	let serverSecret = crossmintSignerSecret(env);
	const saved = (readJsonIfPresent(CROSSMINT_SETUP_RESULT) ?? {}) as { address?: string };

	const sdk = CrossmintWallets.from(createCrossmint({ apiKey: cm.apiKey }));
	const wallets: CrossmintWalletsApi = {
		createWallet: async (args) => {
			const wallet = await sdk.createWallet(args);
			return { address: wallet.address };
		},
		getWallet: async (locator, args) => {
			const wallet = await sdk.getWallet(locator, args);
			return { address: wallet.address };
		},
	};

	const result = await setupCrossmintWallet({
		wallets,
		label: "devnet",
		savedSecret: serverSecret,
		savedAddress: saved.address,
		storeSecret: async (secret) => {
			await storeInInfisical(
				{ CROSSMINT_SERVER_SIGNER_SECRET: secret },
				{ env: "dev", path: "/wallet-spike" },
			);
			serverSecret = secret;
		},
	});
	const secret = serverSecret;
	if (!secret) throw new Error("the server signer secret is missing");

	// The machine's own signer, limited with scopes. The spending limit is a total per interval.
	const wallet = await sdk.getWallet(result.address, { chain: "solana" });
	const signerApi: CrossmintSignerApi = {
		useServerSigner: async () => {
			await wallet.useSigner({ type: "server", secret });
		},
		signers: async () =>
			(await wallet.signers()).map((found) => {
				const s = found as {
					type: string;
					address?: string;
					locator: string;
					status: string;
					scopes?: Scope[];
				};
				const address = s.address ?? s.locator.split(":").at(-1);
				return address ? { ...s, address } : s;
			}),
		addSigner: async (address, scopes) => {
			// The SDK types require prepareOnly. False means the server signer approves it straight away.
			await wallet.addSigner({ type: "external-wallet", address }, { scopes, prepareOnly: false });
		},
		removeSigner: async (address) => {
			await wallet.removeSigner({ type: "external-wallet", address });
		},
	};
	// A small limit over a short interval, so the refusal checks can be rerun after a minute.
	const scopes = machineScopes({
		owner: ownerAddress,
		solLimit: "0.01",
		intervalSeconds: 60,
		// Crossmint checks net balance changes once the whole transaction has run. Wrapping SOL moves SOL into
		// the wallet's own wrapped SOL account, and sending wrapped SOL moves real SOL into the owner's, so
		// when both happen in one transaction the owner's wrapped SOL account is a SOL recipient too.
		extraSolRecipients: [
			await wrappedSolAccount(address(result.address)),
			await wrappedSolAccount(address(ownerAddress)),
			...recipients,
		],
		// Token recipients are wallets, not token accounts. Listing the owner's token account refused.
		tokens: [{ mint: WRAPPED_SOL, recipients: [ownerAddress] }],
	});
	const signer = await setupMachineSigner({
		api: signerApi,
		scopes,
		saved: crossmintMachineSigner(env),
		storeSecret: (machine) =>
			storeInInfisical(
				{ CROSSMINT_MACHINE_SIGNER_SECRET: machine.secretHex },
				{ env: "dev", path: "/wallet-spike" },
			),
	});

	return { result, signer, scopes, saved };
}

/**
 * Opens the saved wallet as the machine's scoped signer, never the server signer. Returns a function that
 * sends an unsigned transaction (hex) through Crossmint and returns its signature.
 */
export async function crossmintMachineSender(env: NodeJS.ProcessEnv) {
	const cm = crossmintEnv(env);
	const machine = crossmintMachineSigner(env);
	if (!machine) throw new Error("No machine signer saved. Run pnpm setup:crossmint first.");
	const saved = readJsonIfPresent(CROSSMINT_SETUP_RESULT) as { address?: string } | undefined;
	if (!saved?.address)
		throw new Error("No Crossmint wallet saved. Run pnpm setup:crossmint first.");

	const keypair = Keypair.fromSecretKey(Buffer.from(machine.secretHex, "hex"));
	const sdk = CrossmintWallets.from(createCrossmint({ apiKey: cm.apiKey }));
	const wallet = SolanaWallet.from(await sdk.getWallet(saved.address, { chain: "solana" }));
	await wallet.useSigner({
		type: "external-wallet",
		address: machine.address,
		onSign: async (transaction) => {
			transaction.sign([keypair]);
			return transaction;
		},
	});
	const send = async (unsignedHex: string) =>
		(
			await wallet.sendTransaction({
				transaction: VersionedTransaction.deserialize(Buffer.from(unsignedHex, "hex")),
			})
		).hash;
	return { walletAddress: saved.address, send };
}
