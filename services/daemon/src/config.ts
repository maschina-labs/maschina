import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			ORCHESTRATOR_URL: env.url(),
			ORCHESTRATOR_DAEMON_TOKEN: env.secret(),
			DAEMON_IDENTITY_PATH: z.string().min(1).default(".maschina/daemon-identity.json"),
			/** How often a healthy daemon checks in. */
			DAEMON_HEARTBEAT_MS: z.coerce.number().int().min(1_000).default(15_000),
			/** Where the node reads balances and prices from. */
			SOLANA_RPC_URL: env.url(),
			/** How long to wait before asking for work again when there was nothing to do. */
			DAEMON_POLL_MS: z.coerce.number().int().min(250).default(5_000),
			/**
			 * How often to renew a lease while a run is working. Well inside the orchestrator's lease
			 * length, so a couple of missed beats during an outage still leave the run held.
			 */
			DAEMON_RENEW_MS: z.coerce.number().int().min(1_000).max(30_000).default(20_000),
			/** The most a trade may pay to be included. Also kept back from spendable SOL. */
			DAEMON_PRIORITY_FEE_LAMPORTS: z.coerce.bigint().nonnegative().default(200_000n),
			/** A Jupiter key lifts the rate limits. Without one the free endpoint is used. */
			JUPITER_API_KEY: z.string().min(1).optional(),
		},
		source,
	);
}
