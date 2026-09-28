import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { chatsFrom, telegramSender, tellForever } from "./alerts.ts";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";
import { enabledPlatforms } from "./platforms.ts";

const config = loadConfig();
const logger = createLogger({
	service: SERVICE,
	level: config.LOG_LEVEL,
	pretty: config.NODE_ENV === "development",
});
const reporter = await initErrorReporting({
	dsn: config.SENTRY_DSN,
	service: SERVICE,
	environment: config.NODE_ENV,
	release: config.SERVICE_VERSION,
});
const platforms = enabledPlatforms(config);
if (platforms.length === 0) logger.warn("no chat platform is configured");

// Telling owners what their machines did needs somewhere to ask and somewhere to send. Without either,
// the bots still start, and say why nobody is being told anything.
const telling = new AbortController();
const chats = chatsFrom(config.TELEGRAM_CHATS);
if (
	config.TELEGRAM_BOT_TOKEN &&
	config.ORCHESTRATOR_URL &&
	config.ORCHESTRATOR_BOTS_TOKEN &&
	chats.size > 0
) {
	void tellForever(
		{
			orchestratorUrl: config.ORCHESTRATOR_URL,
			token: config.ORCHESTRATOR_BOTS_TOKEN,
			chats,
			send: telegramSender(config.TELEGRAM_BOT_TOKEN),
			logger,
			// Only what happens from now on: turning alerts on never replays a machine's history.
			since: new Date(),
			everyMs: config.BOTS_ALERT_EVERY_MS,
		},
		telling.signal,
	);
	logger.info({ owners: chats.size }, "telling owners what their machines do, on Telegram");
} else {
	logger.warn("alerts are off: a bot token, the orchestrator and at least one chat are all needed");
}

startServer({
	app: buildApp({ version: config.SERVICE_VERSION, platforms, logger, reporter }),
	port: config.BOTS_PORT,
	logger,
	shutdown: [
		{ name: "alerts", run: async () => telling.abort() },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
