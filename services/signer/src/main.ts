import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";
import { notWiredYet } from "./not-wired.ts";

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

startServer({
	app: buildApp({
		version: config.SERVICE_VERSION,
		orchestratorToken: config.SIGNER_ORCHESTRATOR_TOKEN,
		logger,
		reporter,
		signer: notWiredYet,
	}),
	port: config.SIGNER_PORT,
	logger,
	shutdown: [{ name: "error reporting", run: () => reporter.flush() }],
});
