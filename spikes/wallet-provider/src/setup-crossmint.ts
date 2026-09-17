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
import { applyCrossmintSetup, CROSSMINT_SETUP_RESULT } from "./crossmint-devnet.ts";
import { UNEXPRESSIBLE_RULES } from "./providers/crossmint-signer.ts";

try {
	const { result, signer, scopes, saved } = await applyCrossmintSetup(process.env);

	mkdirSync("results", { recursive: true });
	const previous = result.created ? {} : saved;
	writeFileSync(
		CROSSMINT_SETUP_RESULT,
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
