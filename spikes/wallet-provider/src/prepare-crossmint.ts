/**
 * pnpm prepare:crossmint   create the token accounts the Crossmint checks send from and to, paid by the Turnkey wallet
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm prepare:crossmint
 *
 * Crossmint's staging project caps the account rent it pays per day, and counts a created account as a
 * recipient. Creating the accounts up front, from the Turnkey test wallet under its own policy, keeps the
 * Crossmint checks from needing either. Creating one that exists already does nothing.
 */

import { address } from "@solana/kit";
import { Turnkey } from "@turnkey/sdk-server";
import { checksEnv, setupEnv, turnkeyEnv } from "./env.ts";
import { readJsonIfPresent } from "./files.ts";
import { turnkeySigner } from "./providers/turnkey-signer.ts";
import { DEVNET_USDC, devnetRpc, submitSigned } from "./solana/devnet.ts";
import { createTokenAccountFor, WRAPPED_SOL } from "./solana/transactions.ts";

try {
	const root = turnkeyEnv(process.env);
	const keys = checksEnv(process.env);
	const { ownerAddress } = setupEnv(process.env);
	const turnkeyWallet = (
		readJsonIfPresent("results/turnkey-setup-devnet.json") as { walletAddress?: string }
	)?.walletAddress;
	const crossmintWallet = (
		readJsonIfPresent("results/crossmint-setup-devnet.json") as { address?: string }
	)?.address;
	if (!turnkeyWallet || !crossmintWallet)
		throw new Error("Run pnpm setup:turnkey and pnpm setup:crossmint first.");

	const client = new Turnkey({
		apiBaseUrl: root.apiBaseUrl,
		apiPublicKey: keys.signerPublicKey,
		apiPrivateKey: keys.signerPrivateKey,
		defaultOrganizationId: root.organizationId,
	}).apiClient();
	const rpc = devnetRpc(keys.heliusApiKey);
	const accounts = [
		{ name: "Crossmint wallet's wrapped SOL", owner: crossmintWallet, mint: WRAPPED_SOL },
		{ name: "owner's devnet USDC", owner: ownerAddress, mint: DEVNET_USDC },
	];
	for (const account of accounts) {
		const blockhash = (await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
		const unsigned = await createTokenAccountFor({
			payer: address(turnkeyWallet),
			owner: address(account.owner),
			mint: account.mint,
			blockhash,
		});
		const signed = await turnkeySigner(turnkeyWallet, client).sign(unsigned);
		if (signed.status !== "signed") {
			throw new Error(
				`Turnkey didn't sign for the ${account.name} account: ${signed.status === "refused" ? signed.reason : signed.message}`,
			);
		}
		process.stdout.write(
			`${account.name}: created, or already existed: ${await submitSigned(rpc, signed.signedHex)}\n`,
		);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
