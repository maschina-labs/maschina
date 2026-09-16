import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			ORCHESTRATOR_PORT: env.port(4100),
			DATABASE_URL: env.postgresUrl(),
			/** Daemons present this to prove they are ours. */
			ORCHESTRATOR_DAEMON_TOKEN: env.secret(),
		},
		source,
	);
}
