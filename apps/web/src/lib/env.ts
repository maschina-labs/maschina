import { env } from "@maschina/env";
import { loadClientEnv } from "@maschina/env/client";

/** Public configuration, validated when the app loads. */
export const config = loadClientEnv(
	{
		VITE_GATEWAY_URL: env.url(),
		VITE_SENTRY_DSN: env.optional(env.url()),
	},
	import.meta.env,
);
