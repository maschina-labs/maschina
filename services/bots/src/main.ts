import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
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

startServer({
	app: buildApp({ version: config.SERVICE_VERSION, platforms, logger, reporter }),
	port: config.BOTS_PORT,
	logger,
	shutdown: [{ name: "error reporting", run: () => reporter.flush() }],
});
