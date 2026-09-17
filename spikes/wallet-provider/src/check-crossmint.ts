/**
 * pnpm check:crossmint   run the policy checks against Crossmint on devnet (#23)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm check:crossmint
 *
 * Sends as the machine's scoped signer, never the server signer. Results go to results/. Errors that
 * aren't recognised as refusals are printed in full, so the classifier can be built from real ones.
 */

import { CrossmintWallets, createCrossmint, SolanaWallet } from "@crossmint/wallets-sdk";
import { address, generateKeyPairSigner } from "@solana/kit";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { CHECKS } from "./checklist.ts";
import { CROSSMINT_DEVNET_CHECKS, crossmintAttempt } from "./crossmint-checks.ts";
import { classifyCrossmintError } from "./crossmint-errors.ts";
import { crossmintEnv, crossmintMachineSigner, heliusKey, setupEnv } from "./env.ts";
import { readJsonIfPresent } from "./files.ts";
import { runChecks, verdict, writeResults } from "./run.ts";
import { devnetRpc } from "./solana/devnet.ts";
import { memoOnly, tokenTransfer, transferSol, WRAPPED_SOL } from "./solana/transactions.ts";

// Real, but not approved for the machine signer. A made-up mint fails simulation for unrelated reasons.
const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

try {
	const env = crossmintEnv(process.env);
	const { ownerAddress } = setupEnv(process.env);
	const machine = crossmintMachineSigner(process.env);
	if (!machine) throw new Error("No machine signer saved. Run pnpm setup:crossmint first.");
	const setup = readJsonIfPresent("results/crossmint-setup-devnet.json") as
		| { address?: string }
		| undefined;
	if (!setup?.address)
		throw new Error("No Crossmint wallet saved. Run pnpm setup:crossmint first.");
	const walletAddress = setup.address;

	const keypair = Keypair.fromSecretKey(Buffer.from(machine.secretHex, "hex"));
	const sdk = CrossmintWallets.from(createCrossmint({ apiKey: env.apiKey }));
	const wallet = SolanaWallet.from(await sdk.getWallet(walletAddress, { chain: "solana" }));
	await wallet.useSigner({
		type: "external-wallet",
		address: machine.address,
		onSign: async (transaction) => {
			transaction.sign([keypair]);
			return transaction;
		},
	});

	const rpc = devnetRpc(heliusKey(process.env));
	const blockhash = async () =>
		(await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
	const stranger = (await generateKeyPairSigner()).address;
	const walletKey = address(walletAddress);
	const owner = address(ownerAddress);

	// Every check goes through the custom transaction path, so a failure comes back with the program logs.
	const sendRaw = async (hex: string) =>
		(
			await wallet.sendTransaction({
				transaction: VersionedTransaction.deserialize(Buffer.from(hex, "hex")),
			})
		).hash;
	const sendSol = async (to: string, lamports: bigint) =>
		sendRaw(
			await transferSol({
				from: walletKey,
				to: address(to),
				lamports,
				blockhash: await blockhash(),
			}),
		);

	const checks = CHECKS.filter((check) => CROSSMINT_DEVNET_CHECKS.includes(check.id));
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
						}),
					),
				"swap-unapproved-token": async () =>
					sendRaw(
						await tokenTransfer({
							wallet: walletKey,
							owner,
							mint: address(DEVNET_USDC),
							amount: 1n,
							decimals: 6,
							blockhash: await blockhash(),
							wrap: false,
						}),
					),
			},
			classifyCrossmintError,
		),
	);

	const path = writeResults({ dir: "results", provider: "crossmint-devnet", checks, results });
	for (const result of results) {
		const expected = checks.find((c) => c.id === result.id)?.expect;
		const o = result.outcome;
		const detail =
			o.status === "allowed" ? o.signature : o.status === "refused" ? o.reason : o.message;
		process.stdout.write(
			`${result.id.padEnd(22)} expected ${expected?.padEnd(8)} got ${o.status.padEnd(8)} ${detail.slice(0, 300)}\n`,
		);
	}
	const { passed, failures } = verdict(checks, results);
	process.stdout.write(`\n${passed ? "PASSED" : "FAILED"}, saved to ${path}\n`);
	for (const failure of failures) process.stdout.write(`  ${failure.slice(0, 300)}\n`);
	process.exit(passed ? 0 : 1);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
