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
			 * The domain a sign in message names, and the only domain its signature is good for. Wallets
			 * check it against the page's own origin, which includes the port in development, so this is
			 * a host rather than a hostname.
			 */
			GATEWAY_DOMAIN: z.string().min(1).default("localhost:3000"),
			/** Where the app lives, shown in the message so a person sees what they are signing into. */
			GATEWAY_APP_URL: env.url().default("http://localhost:3000"),
			/**
			 * The parent domain the session cookie is scoped to, so the app and the API share it. Left
			 * unset in development, where there is no shared parent and no https.
			 */
			GATEWAY_COOKIE_DOMAIN: z.string().min(1).optional(),
		},
		source,
	);
}
