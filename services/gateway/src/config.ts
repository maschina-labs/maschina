import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			GATEWAY_PORT: env.port(4000),
			GATEWAY_CORS_ORIGINS: env.list(),
		},
		source,
	);
}
