import { MaschinaError } from "@maschina/core";
import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

/** Solana's public endpoints: rate limited, and no place to send real money through. */
const PUBLIC_RPC = /(^|\.)api\.(mainnet-beta|devnet|testnet)\.solana\.com$/;

export function loadConfig(source?: EnvSource) {
	const config = loadEnv(
		{
			...serviceEnv,
			SIGNER_PORT: env.port(4200),
			/** The orchestrator presents this. Nothing else may ask for a signature. */
			SIGNER_ORCHESTRATOR_TOKEN: env.secret(),
			/** The record: machine facts in, refusals, holds and settlements out. */
			DATABASE_URL: env.postgresUrl(),
			/** Where transactions are sent and confirmed. A paid endpoint, never the public one. */
			SOLANA_RPC_URL: env.url(),
			TURNKEY_API_BASE_URL: env.url().default("https://api.turnkey.com"),
			TURNKEY_ORGANIZATION_ID: z.string().min(1),
			/**
			 * The signing key only. The admin key, which can create wallets and write policies, is never
			 * given to the running signer, so the signer can never change the policy it is held to.
			 */
			TURNKEY_SIGNER_API_PUBLIC_KEY: z.string().min(1),
			TURNKEY_SIGNER_API_PRIVATE_KEY: env.secret(),
			/** Held back on every trade for what it costs to send: the priority fee cap plus the base fee. */
			SIGNER_FEE_ALLOWANCE_LAMPORTS: z.coerce.bigint().nonnegative().default(205_000n),
		},
		source,
	);

	if (
		config.NODE_ENV === "production" &&
		PUBLIC_RPC.test(new URL(config.SOLANA_RPC_URL).hostname)
	) {
		throw new MaschinaError(
			"invalid_input",
			"SOLANA_RPC_URL is Solana's public endpoint, which is not for production trading",
		);
	}
	return config;
}
