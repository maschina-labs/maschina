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
			/** How long a node holds a run before another node may take it over. */
			ORCHESTRATOR_LEASE_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
		},
		source,
	);
}
