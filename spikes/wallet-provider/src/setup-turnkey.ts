/**
 * pnpm setup:turnkey   create or check the spike's machine wallet, signer and policies in Turnkey
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm setup:turnkey
 *
 * Uses the root API key to set things up, then proves the new signer's key works. A new signer key is
 * saved straight into Infisical. Nothing secret is printed. The result is saved in results/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { address } from "@solana/kit";
import { Turnkey } from "@turnkey/sdk-server";
import type { ApiKeyPair } from "./api-key.ts";
import { generateApiKeyPair } from "./api-key.ts";
import { MissingEnvError, setupEnv, turnkeyEnv } from "./env.ts";
import { storeInInfisical } from "./infisical.ts";
import { SOLANA_PROGRAMS } from "./policy.ts";
import { turnkey } from "./providers/turnkey.ts";
import { setupMachineWallet } from "./providers/turnkey-setup.ts";
import { wrappedSolAccount } from "./solana/transactions.ts";

const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

try {
	const root = turnkeyEnv(process.env);
	const setup = setupEnv(process.env);
	const client = new Turnkey({
		apiBaseUrl: root.apiBaseUrl,
		apiPublicKey: root.apiPublicKey,
		apiPrivateKey: root.apiPrivateKey,
		defaultOrganizationId: root.organizationId,
	}).apiClient();

	let newKeys: ApiKeyPair | undefined;
	const result = await setupMachineWallet({
		admin: client,
		label: "devnet",
		ownerAddress: setup.ownerAddress,
		signerPublicKey: setup.signerPublicKey,
		newKeyPair: () => {
			newKeys = generateApiKeyPair();
			return newKeys;
		},
		storeSigner: (keys) =>
			storeInInfisical(
				{
					TURNKEY_SIGNER_API_PUBLIC_KEY: keys.publicKey,
					TURNKEY_SIGNER_API_PRIVATE_KEY: keys.privateKey,
				},
				{ env: "dev", path: "/wallet-spike" },
			),
		// Wrapping SOL for a token swap moves SOL into the wallet's own wrapped SOL account.
		extraRecipients: async (wallet) => [await wrappedSolAccount(address(wallet))],
		settings: {
			approvedPrograms: Object.values(SOLANA_PROGRAMS),
			approvedMints: [DEVNET_USDC, WRAPPED_SOL],
			maxLamportsPerTransfer: 50_000_000n,
		},
	});

	// Prove the signer's key is accepted, using the key just made or the one saved earlier.
	const signerPrivate = newKeys?.privateKey ?? process.env["TURNKEY_SIGNER_API_PRIVATE_KEY"];
	const signerPublic = newKeys?.publicKey ?? setup.signerPublicKey;
	if (!signerPrivate || !signerPublic)
		throw new MissingEnvError(["TURNKEY_SIGNER_API_PRIVATE_KEY"]);
	const check = await turnkey({
		...root,
		apiPublicKey: signerPublic,
		apiPrivateKey: signerPrivate,
	}).ping();

	mkdirSync("results", { recursive: true });
	const report = { at: new Date().toISOString(), ...result, signerKeyWorks: check };
	writeFileSync(`results/turnkey-setup-devnet.json`, `${JSON.stringify(report, null, "\t")}\n`);

	process.stdout.write(
		[
			`signer: ${result.signerUserId}`,
			`wallet: ${result.walletAddress}`,
			`changed: ${result.changed.length > 0 ? result.changed.join(", ") : "nothing, already set up"}`,
			`signer key: ${check.ok ? "ok" : "failed"}, ${check.detail}`,
			"",
		].join("\n"),
	);
	process.exit(check.ok ? 0 : 1);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
