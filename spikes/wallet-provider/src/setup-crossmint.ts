/**
 * pnpm setup:crossmint   create or find the spike's Crossmint wallet on Solana (#21)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm setup:crossmint
 *
 * Staging keys create devnet wallets. A new server secret is saved straight into Infisical before the
 * wallet is created. Nothing secret is printed. The result is saved in results/.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CrossmintWallets, createCrossmint } from "@crossmint/wallets-sdk";
import { crossmintEnv, crossmintSignerSecret } from "./env.ts";
import { storeInInfisical } from "./infisical.ts";
import { type CrossmintWalletsApi, setupCrossmintWallet } from "./providers/crossmint-setup.ts";

const RESULT = "results/crossmint-setup-devnet.json";

try {
	const env = crossmintEnv(process.env);
	const savedSecret = crossmintSignerSecret(process.env);
	const saved = existsSync(RESULT)
		? (JSON.parse(readFileSync(RESULT, "utf8")) as { address?: string })
		: {};

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
		savedSecret,
		savedAddress: saved.address,
		storeSecret: (secret) =>
			storeInInfisical(
				{ CROSSMINT_SERVER_SIGNER_SECRET: secret },
				{ env: "dev", path: "/wallet-spike" },
			),
	});

	mkdirSync("results", { recursive: true });
	const previous = result.created ? {} : saved;
	writeFileSync(
		RESULT,
		`${JSON.stringify({ ...previous, at: new Date().toISOString(), environment: "staging", ...result }, null, "\t")}\n`,
	);
	process.stdout.write(
		[
			`wallet: ${result.address}`,
			result.created
				? `created in ${Math.round(result.createMs)} ms`
				: "already exists, found it with the saved secret",
			"",
		].join("\n"),
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
