/**
 * pnpm time:providers   time wallet creation on both providers, and Turnkey signing (#26)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm time:providers
 *
 * Creates three throwaway wallets on each provider. They hold nothing and are never used again; the
 * Crossmint ones get a fresh recovery secret that isn't kept. Turnkey signing is timed on an allowed
 * transfer that is signed and never sent. Crossmint signs and sends in one call, so its signing time is
 * the time of the allowed checks already saved in results/. Results go to results/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { CrossmintWallets, createCrossmint } from "@crossmint/wallets-sdk";
import { address } from "@solana/kit";
import { Turnkey } from "@turnkey/sdk-server";
import { checksEnv, crossmintEnv, setupEnv, turnkeyEnv } from "./env.ts";
import { readJsonIfPresent } from "./files.ts";
import { newServerSecret } from "./providers/crossmint-setup.ts";
import { turnkeySigner } from "./providers/turnkey-signer.ts";
import { devnetRpc } from "./solana/devnet.ts";
import { transferSol } from "./solana/transactions.ts";
import { summarize, timeEach } from "./timing.ts";

const RUNS = 3;
const SIGNING_RUNS = 5;
const SOLANA_ACCOUNT = {
	curve: "CURVE_ED25519",
	pathFormat: "PATH_FORMAT_BIP32",
	path: "m/44'/501'/0'/0'",
	addressFormat: "ADDRESS_FORMAT_SOLANA",
} as const;

try {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const root = turnkeyEnv(process.env);
	const keys = checksEnv(process.env);
	const { ownerAddress } = setupEnv(process.env);
	const turnkeyWallet = (
		readJsonIfPresent("results/turnkey-setup-devnet.json") as { walletAddress?: string } | undefined
	)?.walletAddress;
	if (!turnkeyWallet) throw new Error("Run pnpm setup:turnkey first.");

	const admin = new Turnkey({
		apiBaseUrl: root.apiBaseUrl,
		apiPublicKey: root.apiPublicKey,
		apiPrivateKey: root.apiPrivateKey,
		defaultOrganizationId: root.organizationId,
	}).apiClient();
	const turnkeyCreate = await timeEach(RUNS, (i) =>
		admin.createWallet({ walletName: `timing-${stamp}-${i}`, accounts: [SOLANA_ACCOUNT] }),
	);

	const signerClient = new Turnkey({
		apiBaseUrl: root.apiBaseUrl,
		apiPublicKey: keys.signerPublicKey,
		apiPrivateKey: keys.signerPrivateKey,
		defaultOrganizationId: root.organizationId,
	}).apiClient();
	const signer = turnkeySigner(turnkeyWallet, signerClient);
	const rpc = devnetRpc(keys.heliusApiKey);
	const blockhash = (await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
	const unsigned = await transferSol({
		from: address(turnkeyWallet),
		to: address(ownerAddress),
		lamports: 1_000_000n,
		blockhash,
	});
	const turnkeySign = await timeEach(SIGNING_RUNS, async () => {
		const outcome = await signer.sign(unsigned);
		if (outcome.status !== "signed") throw new Error(`Turnkey didn't sign: ${outcome.status}`);
	});

	const sdk = CrossmintWallets.from(createCrossmint({ apiKey: crossmintEnv(process.env).apiKey }));
	const crossmintCreate = await timeEach(RUNS, (i) =>
		sdk.createWallet({
			chain: "solana",
			recovery: { type: "server", secret: newServerSecret() },
			alias: `timing-${stamp}-${i}`,
		}),
	);

	const report = {
		at: new Date().toISOString(),
		turnkey: {
			createWallet: summarize(turnkeyCreate),
			signTransaction: summarize(turnkeySign),
		},
		crossmint: { createWallet: summarize(crossmintCreate) },
	};
	mkdirSync("results", { recursive: true });
	const path = `results/provider-timings-${stamp}.json`;
	writeFileSync(path, `${JSON.stringify(report, null, "\t")}\n`);
	process.stdout.write(`TIMINGS ${JSON.stringify(report)}\nsaved to ${path}\n`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
