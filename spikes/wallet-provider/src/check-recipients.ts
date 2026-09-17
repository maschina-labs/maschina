/**
 * pnpm check:recipients turnkey|crossmint   test approved payment recipients on devnet (#25)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm check:recipients turnkey
 *
 * Adds a recipient to the machine wallet's policy, pays it, pays a stranger, removes it, and pays it
 * again. The approved recipient is the other provider's test wallet, so the devnet SOL isn't lost.
 * Turnkey payments that should be refused are never sent. The wallet address is compared before and
 * after, to show whether the list changed without replacing the wallet.
 */

import { address, generateKeyPairSigner } from "@solana/kit";
import { Turnkey } from "@turnkey/sdk-server";
import { crossmintAttempt } from "./crossmint-checks.ts";
import { applyCrossmintSetup, crossmintMachineSender } from "./crossmint-devnet.ts";
import { classifyCrossmintError } from "./crossmint-errors.ts";
import { checksEnv } from "./env.ts";
import { readJsonIfPresent } from "./files.ts";
import { turnkeySigner } from "./providers/turnkey-signer.ts";
import { RECIPIENT_CHECKS, type RecipientSteps, runRecipientChecks } from "./recipient-checks.ts";
import { attemptFor } from "./refusal-checks.ts";
import { reportRun } from "./report.ts";
import { devnetRpc, submitSigned } from "./solana/devnet.ts";
import { transferSol } from "./solana/transactions.ts";
import { applyTurnkeySetup } from "./turnkey-devnet.ts";

// Enough for a new account to stay open, well inside both providers' limits.
const PAYMENT = 1_000_000n;

const savedAddress = (path: string, field: string) => {
	const value = (readJsonIfPresent(path) as Record<string, unknown> | undefined)?.[field];
	if (typeof value !== "string") throw new Error(`${path} has no ${field}. Run the setups first.`);
	return value;
};

try {
	const provider = process.argv[2];
	if (provider !== "turnkey" && provider !== "crossmint") {
		throw new Error("Usage: pnpm check:recipients turnkey|crossmint");
	}
	const keys = checksEnv(process.env);
	const rpc = devnetRpc(keys.heliusApiKey);
	const blockhash = async () =>
		(await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
	const turnkeyWallet = savedAddress("results/turnkey-setup-devnet.json", "walletAddress");
	const crossmintWallet = savedAddress("results/crossmint-setup-devnet.json", "address");
	const stranger = (await generateKeyPairSigner()).address;

	let steps: RecipientSteps;
	let recipient: string;
	let walletNow: () => Promise<string>;
	if (provider === "turnkey") {
		recipient = crossmintWallet;
		const root = (await applyTurnkeySetup(process.env)).root;
		const client = new Turnkey({
			apiBaseUrl: root.apiBaseUrl,
			apiPublicKey: keys.signerPublicKey,
			apiPrivateKey: keys.signerPrivateKey,
			defaultOrganizationId: root.organizationId,
		}).apiClient();
		const signer = turnkeySigner(turnkeyWallet, client);
		const paying: Record<string, string> = {};
		const attempt = attemptFor(
			{
				build: async (id) =>
					transferSol({
						from: address(turnkeyWallet),
						to: address(paying[id] ?? ""),
						lamports: PAYMENT,
						blockhash: await blockhash(),
					}),
				sign: (hex) => signer.sign(hex),
				submit: (hex) => submitSigned(rpc, hex),
			},
			RECIPIENT_CHECKS.map((c) => c.id),
		);
		steps = {
			setRecipients: async (recipients) => {
				await applyTurnkeySetup(process.env, recipients);
			},
			pay: (check, to) => {
				paying[check.id] = to;
				return attempt(check);
			},
		};
		walletNow = async () => (await applyTurnkeySetup(process.env)).result.walletAddress;
	} else {
		recipient = turnkeyWallet;
		const { send } = await crossmintMachineSender(process.env);
		steps = {
			setRecipients: async (recipients) => {
				await applyCrossmintSetup(process.env, recipients);
			},
			pay: (check, to) =>
				crossmintAttempt(
					{
						[check.id]: async () =>
							send(
								await transferSol({
									from: address(crossmintWallet),
									to: address(to),
									lamports: PAYMENT,
									blockhash: await blockhash(),
								}),
							),
					},
					classifyCrossmintError,
				)(check),
		};
		walletNow = async () => (await applyCrossmintSetup(process.env)).result.address;
	}

	const walletBefore = provider === "turnkey" ? turnkeyWallet : crossmintWallet;
	const results = await runRecipientChecks({ recipient, stranger, steps });
	const walletAfter = await walletNow();
	process.stdout.write(
		`wallet ${walletBefore === walletAfter ? "kept" : "REPLACED"} while the list changed: ${walletAfter}\n\n`,
	);
	process.exit(reportRun(`${provider}-recipients-devnet`, RECIPIENT_CHECKS, results));
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
