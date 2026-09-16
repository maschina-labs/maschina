import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			BOTS_PORT: env.port(4300),
			GATEWAY_URL: env.url(),
			TELEGRAM_BOT_TOKEN: env.optional(z.string().min(20)),
		},
		source,
	);
}
