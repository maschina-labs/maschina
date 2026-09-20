import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			PROVISIONER_PORT: env.port(4400),
			/** The gateway presents this. Nothing else may create a machine. */
			PROVISIONER_GATEWAY_TOKEN: env.secret(),
			DATABASE_URL: env.postgresUrl(),
			TURNKEY_API_BASE_URL: env.url().default("https://api.turnkey.com"),
			TURNKEY_ORGANIZATION_ID: z.string().min(1),
			/**
			 * The admin key, which creates wallets and writes policies. This is the only service that holds
			 * it, and it can never sign for a machine: that is the signer's key, and Turnkey keeps them apart.
			 */
			TURNKEY_API_PUBLIC_KEY: z.string().min(1),
			TURNKEY_API_PRIVATE_KEY: env.secret(),
			/** The signer's Turnkey user, named by every wallet policy as its only approver. */
			TURNKEY_SIGNER_API_PUBLIC_KEY: z.string().min(1),
			TURNKEY_SIGNER_API_PRIVATE_KEY: env.secret(),
		},
		source,
	);
}
