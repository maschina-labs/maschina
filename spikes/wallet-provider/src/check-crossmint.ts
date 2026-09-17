/**
 * pnpm check:crossmint [check ids]   run the policy checks against Crossmint on devnet (#23)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm check:crossmint
 *
 * Sends as the machine's scoped signer, never the server signer. Results go to results/. Errors that
 * aren't recognised as refusals are printed in full, so the classifier can be built from real ones.
 */

import { address, generateKeyPairSigner } from "@solana/kit";
import { CHECKS } from "./checklist.ts";
import { CROSSMINT_DEVNET_CHECKS, crossmintAttempt } from "./crossmint-checks.ts";
import { crossmintMachineSender } from "./crossmint-devnet.ts";
import { classifyCrossmintError } from "./crossmint-errors.ts";
import { heliusKey, setupEnv } from "./env.ts";
import { reportRun } from "./report.ts";
import { runChecks } from "./run.ts";
import { DEVNET_USDC, devnetRpc } from "./solana/devnet.ts";
import { memoOnly, tokenTransfer, transferSol, WRAPPED_SOL } from "./solana/transactions.ts";

try {
	const { ownerAddress } = setupEnv(process.env);
	const { walletAddress, send: sendRaw } = await crossmintMachineSender(process.env);

	const rpc = devnetRpc(heliusKey(process.env));
	const blockhash = async () =>
		(await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
	const stranger = (await generateKeyPairSigner()).address;
	const walletKey = address(walletAddress);
	const owner = address(ownerAddress);

	// Every check goes through the custom transaction path, so a failure comes back with the program logs.
	const sendSol = async (to: string, lamports: bigint) =>
		sendRaw(
			await transferSol({
				from: walletKey,
				to: address(to),
				lamports,
				blockhash: await blockhash(),
			}),
		);

	// Check ids on the command line run just those, to spend less when investigating one.
	const only = process.argv.slice(2);
	const checks = CHECKS.filter(
		(check) =>
			CROSSMINT_DEVNET_CHECKS.includes(check.id) && (only.length === 0 || only.includes(check.id)),
	);
	const results = await runChecks(
		checks,
		crossmintAttempt(
			{
				"transfer-owner": () => sendSol(ownerAddress, 500_000n),
				"transfer-outside": () => sendSol(stranger, 500_000n),
				// The limit is 0.01 SOL per minute. Everything allowed in one run adds up to 0.0097.
				"under-size-limit": () => sendSol(ownerAddress, 9_000_000n),
				"over-size-limit": () => sendSol(ownerAddress, 11_000_000n),
				"unapproved-program": async () =>
					sendRaw(
						await memoOnly({
							payer: walletKey,
							text: "maschina policy check",
							blockhash: await blockhash(),
						}),
					),
				"swap-approved-tokens": async () =>
					sendRaw(
						await tokenTransfer({
							wallet: walletKey,
							owner,
							mint: WRAPPED_SOL,
							amount: 200_000n,
							blockhash: await blockhash(),
							createDestination: false,
						}),
					),
				"swap-unapproved-token": async () =>
					sendRaw(
						await tokenTransfer({
							wallet: walletKey,
							owner,
							// Real, but not approved for the machine signer. A made-up mint fails simulation for unrelated reasons.
							mint: DEVNET_USDC,
							amount: 1n,
							decimals: 6,
							blockhash: await blockhash(),
							createDestination: false,
							wrap: false,
						}),
					),
			},
			classifyCrossmintError,
		),
	);

	process.exit(reportRun("crossmint-devnet", checks, results));
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
