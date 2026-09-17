/**
 * pnpm check:turnkey   run the policy checks against Turnkey on devnet (#19)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm check:turnkey
 *
 * Signs as `spike-signer`, never as root. Allowed transactions land on devnet and send small amounts
 * back to the owner. Transactions that should be refused are never sent. Results go to results/.
 */

import { readFileSync } from "node:fs";
import { address, generateKeyPairSigner } from "@solana/kit";
import { Turnkey } from "@turnkey/sdk-server";
import { CHECKS } from "./checklist.ts";
import { checksEnv, setupEnv, turnkeyEnv } from "./env.ts";
import { turnkeySigner } from "./providers/turnkey-signer.ts";
import { attemptFor, TURNKEY_DEVNET_CHECKS } from "./refusal-checks.ts";
import { reportRun } from "./report.ts";
import { runChecks } from "./run.ts";
import { devnetRpc, submitSigned } from "./solana/devnet.ts";
import { memoOnly, tokenTransfer, transferSol, WRAPPED_SOL } from "./solana/transactions.ts";

const SOL = 1_000_000_000n;

try {
	const root = turnkeyEnv(process.env);
	const { ownerAddress } = setupEnv(process.env);
	const keys = checksEnv(process.env);
	const setup = JSON.parse(readFileSync("results/turnkey-setup-devnet.json", "utf8")) as {
		walletAddress: string;
	};
	const wallet = address(setup.walletAddress);
	const owner = address(ownerAddress);

	const client = new Turnkey({
		apiBaseUrl: root.apiBaseUrl,
		apiPublicKey: keys.signerPublicKey,
		apiPrivateKey: keys.signerPrivateKey,
		defaultOrganizationId: root.organizationId,
	}).apiClient();
	const signer = turnkeySigner(wallet, client);
	const rpc = devnetRpc(keys.heliusApiKey);
	// Addresses nobody approved: a stranger to send SOL to, and a mint that isn't allowed.
	const stranger = (await generateKeyPairSigner()).address;
	const unapprovedMint = (await generateKeyPairSigner()).address;

	const blockhash = async () =>
		(await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
	const builders: Record<string, () => Promise<string>> = {
		"transfer-owner": async () =>
			transferSol({ from: wallet, to: owner, lamports: SOL / 1000n, blockhash: await blockhash() }),
		"transfer-outside": async () =>
			transferSol({
				from: wallet,
				to: stranger,
				lamports: SOL / 1000n,
				blockhash: await blockhash(),
			}),
		"under-size-limit": async () =>
			transferSol({ from: wallet, to: owner, lamports: 49_000_000n, blockhash: await blockhash() }),
		"over-size-limit": async () =>
			transferSol({ from: wallet, to: owner, lamports: 51_000_000n, blockhash: await blockhash() }),
		"unapproved-program": async () =>
			memoOnly({ payer: wallet, text: "maschina policy check", blockhash: await blockhash() }),
		"swap-approved-tokens": async () =>
			tokenTransfer({
				wallet,
				owner,
				mint: WRAPPED_SOL,
				amount: SOL / 1000n,
				blockhash: await blockhash(),
			}),
		"swap-unapproved-token": async () =>
			tokenTransfer({
				wallet,
				owner,
				mint: unapprovedMint,
				amount: 1n,
				blockhash: await blockhash(),
				wrap: false,
			}),
	};

	const checks = CHECKS.filter((check) => TURNKEY_DEVNET_CHECKS.includes(check.id));
	const results = await runChecks(
		checks,
		attemptFor({
			build: async (id) => {
				const build = builders[id];
				if (!build) throw new Error(`no transaction for ${id}`);
				return build();
			},
			sign: (hex) => signer.sign(hex),
			submit: (hex) => submitSigned(rpc, hex),
		}),
	);

	process.exit(reportRun("turnkey-devnet", checks, results));
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
