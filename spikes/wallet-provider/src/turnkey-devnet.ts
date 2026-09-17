/**
 * The spike's Turnkey machine wallet on devnet, set up the same way wherever it's needed: by
 * `pnpm setup:turnkey`, and by the recipient checks, which add a recipient and take it away again.
 */

import { address } from "@solana/kit";
import { Turnkey } from "@turnkey/sdk-server";
import { type ApiKeyPair, generateApiKeyPair } from "./api-key.ts";
import { setupEnv, turnkeyEnv } from "./env.ts";
import { storeInInfisical } from "./infisical.ts";
import { SOLANA_PROGRAMS } from "./policy.ts";
import { setupMachineWallet } from "./providers/turnkey-setup.ts";
import { DEVNET_USDC } from "./solana/devnet.ts";
import { WRAPPED_SOL, wrappedSolAccount } from "./solana/transactions.ts";

/** Creates or checks the wallet, signer and policies. `recipients` are approved as well as the owner. */
export async function applyTurnkeySetup(env: NodeJS.ProcessEnv, recipients: string[] = []) {
	const root = turnkeyEnv(env);
	const setup = setupEnv(env);
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
		extraRecipients: async (wallet) => [await wrappedSolAccount(address(wallet)), ...recipients],
		settings: {
			approvedPrograms: Object.values(SOLANA_PROGRAMS),
			approvedMints: [DEVNET_USDC, WRAPPED_SOL],
			maxLamportsPerTransfer: 50_000_000n,
		},
	});
	return { root, setup, result, newKeys };
}
