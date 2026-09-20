import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			GATEWAY_PORT: env.port(4000),
			GATEWAY_CORS_ORIGINS: env.list(),
			DATABASE_URL: env.postgresUrl(),
			/** Where machines are created. The gateway never holds a wallet provider key itself. */
			PROVISIONER_URL: env.url(),
			PROVISIONER_GATEWAY_TOKEN: env.secret(),
			/**
			 * A stand-in for a session while wallet sign-in is being built: the owner every request is
			 * treated as. Refused in production, where only a real signature makes an owner.
			 */
			GATEWAY_DEV_OWNER_WALLET: z.string().min(32).max(44).optional(),
		},
		source,
	);
}
