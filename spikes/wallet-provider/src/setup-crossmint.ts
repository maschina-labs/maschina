/**
 * pnpm setup:crossmint   create or find the spike's Crossmint wallet on Solana (#21), and its scoped
 *                        machine signer (#22)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm setup:crossmint
 *
 * Staging keys create devnet wallets. A new server secret is saved straight into Infisical before the
 * wallet is created. Nothing secret is printed. The result is saved in results/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { CrossmintWallets, createCrossmint } from "@crossmint/wallets-sdk";
import { address } from "@solana/kit";
import { crossmintEnv, crossmintMachineSigner, crossmintSignerSecret, setupEnv } from "./env.ts";
import { readJsonIfPresent } from "./files.ts";
import { storeInInfisical } from "./infisical.ts";
import { type CrossmintWalletsApi, setupCrossmintWallet } from "./providers/crossmint-setup.ts";
import {
	type CrossmintSignerApi,
	machineScopes,
	type Scope,
	setupMachineSigner,
	UNEXPRESSIBLE_RULES,
} from "./providers/crossmint-signer.ts";
import { WRAPPED_SOL, wrappedSolAccount } from "./solana/transactions.ts";

const RESULT = "results/crossmint-setup-devnet.json";

try {
	const env = crossmintEnv(process.env);
	const { ownerAddress } = setupEnv(process.env);
	let serverSecret = crossmintSignerSecret(process.env);
	const saved = (readJsonIfPresent(RESULT) ?? {}) as { address?: string };

	const sdk = CrossmintWallets.from(createCrossmint({ apiKey: env.apiKey }));
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
		// Wrapping SOL for a token transfer moves SOL into the wallet's own wrapped SOL account.
		extraSolRecipients: [await wrappedSolAccount(address(result.address))],
		// For tokens Crossmint checks the destination token account, so the owner's own one is listed.
		tokens: [{ mint: WRAPPED_SOL, recipients: [await wrappedSolAccount(address(ownerAddress))] }],
	});
	const signer = await setupMachineSigner({
		api: signerApi,
		scopes,
		saved: crossmintMachineSigner(process.env),
		storeSecret: (machine) =>
			storeInInfisical(
				{ CROSSMINT_MACHINE_SIGNER_SECRET: machine.secretHex },
				{ env: "dev", path: "/wallet-spike" },
			),
	});

	mkdirSync("results", { recursive: true });
	const previous = result.created ? {} : saved;
	writeFileSync(
		RESULT,
		`${JSON.stringify({ ...previous, at: new Date().toISOString(), environment: "staging", ...result, machineSigner: signer.address, scopes, cannotExpress: UNEXPRESSIBLE_RULES }, null, "\t")}\n`,
	);
	process.stdout.write(
		[
			`wallet: ${result.address}`,
			result.created
				? `created in ${Math.round(result.createMs)} ms`
				: "already exists, found it with the saved secret",
			`machine signer: ${signer.address}`,
			`changed: ${signer.changed.length > 0 ? signer.changed.join(", ") : "nothing, already set up"}`,
			`can't express: ${UNEXPRESSIBLE_RULES.map((r) => r.rule).join(", ")}`,
			"",
		].join("\n"),
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
