/** The Vercel entry point. Every request is routed here by vercel.json. */

import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { handle } from "hono/vercel";
import { buildApp, SERVICE } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { machinePorts } from "../src/deps.ts";

const config = loadConfig();
const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
const reporter = await initErrorReporting({
	dsn: config.SENTRY_DSN,
	service: SERVICE,
	environment: config.NODE_ENV,
	release: config.SERVICE_VERSION,
});

const gateway = machinePorts(config);

export default handle(
	buildApp({
		version: config.SERVICE_VERSION,
		corsOrigins: config.GATEWAY_CORS_ORIGINS,
		logger,
		reporter,
		machines: gateway.ports,
		auth: gateway.auth,
		cookie: gateway.cookie,
	}),
);
