import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			SIGNER_PORT: env.port(4200),
			/** The orchestrator presents this. Nothing else may ask for a signature. */
			SIGNER_ORCHESTRATOR_TOKEN: env.secret(),
		},
		source,
	);
}
