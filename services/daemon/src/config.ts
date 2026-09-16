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
		},
		source,
	);
}
