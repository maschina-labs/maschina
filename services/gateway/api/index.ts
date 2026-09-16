/** The Vercel entry point. Every request is routed here by vercel.json. */

import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { handle } from "hono/vercel";
import { buildApp, SERVICE } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";

const config = loadConfig();
const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
const reporter = await initErrorReporting({
	dsn: config.SENTRY_DSN,
	service: SERVICE,
	environment: config.NODE_ENV,
	release: config.SERVICE_VERSION,
});

export default handle(
	buildApp({
		version: config.SERVICE_VERSION,
		corsOrigins: config.GATEWAY_CORS_ORIGINS,
		logger,
		reporter,
	}),
);
