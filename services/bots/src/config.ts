import { type EnvSource, env, loadEnv, serviceEnv } from "@maschina/env";
import { z } from "zod";

export function loadConfig(source?: EnvSource) {
	return loadEnv(
		{
			...serviceEnv,
			BOTS_PORT: env.port(4300),
			GATEWAY_URL: env.url(),
			TELEGRAM_BOT_TOKEN: env.optional(z.string().min(20)),
			/** Which Telegram chat to tell, by owner: "ownerId=chatId,ownerId=chatId". */
			TELEGRAM_CHATS: z.string().optional(),
			/** Where alerts come from. Unset, the bots tell nobody anything. */
			ORCHESTRATOR_URL: env.optional(env.url()),
			ORCHESTRATOR_BOTS_TOKEN: env.optional(env.secret()),
			/** How often to look for something to tell. */
			BOTS_ALERT_EVERY_MS: z.coerce.number().int().min(5_000).max(300_000).default(20_000),
		},
		source,
	);
}
