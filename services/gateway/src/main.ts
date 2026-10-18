import { systemClock } from "@maschina/core";
import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";
import { contactDesk } from "./contact.ts";
import { machinePorts } from "./deps.ts";
import { whoMayRunOnRealMoney } from "./live-machines.ts";
import { newsDesk } from "./news.ts";

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

const gateway = machinePorts(config, undefined, logger);
// Paper AI traders tick inside the gateway: they need prices and quotes, never a signature.
gateway.runner?.start();

startServer({
	app: buildApp({
		version: config.SERVICE_VERSION,
		corsOrigins: config.GATEWAY_CORS_ORIGINS,
		logger,
		reporter,
		machines: gateway.ports,
		liveWallets: whoMayRunOnRealMoney(config.LIVE_MACHINE_WALLETS),
		machineCaps: {
			paper: config.GATEWAY_MAX_PAPER_MACHINES,
			live: config.GATEWAY_MAX_LIVE_MACHINES,
		},
		auth: gateway.auth,
		people: gateway.people,
		cookie: gateway.cookie,
		halt: gateway.halt,
		manager: gateway.manager,
		news: newsDesk({ clock: systemClock }),
		publicRecord: gateway.publicRecord,
		checks: [{ name: "database", check: gateway.ready }],
		contact: config.RESEND_API_KEY ? contactDesk({ apiKey: config.RESEND_API_KEY }) : undefined,
	}),
	port: config.GATEWAY_PORT,
	logger,
	statusHeartbeatUrl: config.GATEWAY_STATUS_HEARTBEAT_URL,
	shutdown: [
		{ name: "database", run: gateway.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
