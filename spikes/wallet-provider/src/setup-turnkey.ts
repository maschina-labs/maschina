/**
 * pnpm setup:turnkey   create or check the spike's machine wallet, signer and policies in Turnkey
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm setup:turnkey
 *
 * Uses the root API key to set things up, then proves the new signer's key works. A new signer key is
 * saved straight into Infisical. Nothing secret is printed. The result is saved in results/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { MissingEnvError } from "./env.ts";
import { turnkey } from "./providers/turnkey.ts";
import { applyTurnkeySetup } from "./turnkey-devnet.ts";

try {
	const { root, setup, result, newKeys } = await applyTurnkeySetup(process.env);

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
