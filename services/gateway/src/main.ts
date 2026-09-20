import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";
import { machinePorts } from "./deps.ts";

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

const machines = machinePorts(config);

startServer({
	app: buildApp({
		version: config.SERVICE_VERSION,
		corsOrigins: config.GATEWAY_CORS_ORIGINS,
		logger,
		reporter,
		machines: machines.ports,
	}),
	port: config.GATEWAY_PORT,
	logger,
	shutdown: [
		{ name: "database", run: machines.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
