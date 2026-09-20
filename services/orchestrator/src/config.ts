import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			ORCHESTRATOR_PORT: env.port(4100),
			DATABASE_URL: env.postgresUrl(),
			/** Daemons present this to prove they are ours. */
			ORCHESTRATOR_DAEMON_TOKEN: env.secret(),
			/** The signer. Only the orchestrator may ask it anything. */
			SIGNER_URL: env.url(),
			SIGNER_ORCHESTRATOR_TOKEN: env.secret(),
			/** How often the watcher looks at prices for machines waiting on a level. */
			ORCHESTRATOR_PRICE_EVERY_MS: z.coerce.number().int().min(1_000).max(300_000).default(15_000),
			/** A Jupiter key lifts the rate limits on prices. Without one the free endpoint is used. */
			JUPITER_API_KEY: z.string().min(1).optional(),
			/** How long a node holds a run before another node may take it over. */
			ORCHESTRATOR_LEASE_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
		},
		source,
	);
}
