import { createLogger, initErrorReporting, onShutdown } from "@maschina/telemetry";
import { loadConfig } from "./config.ts";
import { runHeartbeat } from "./heartbeat.ts";
import { loadOrCreateIdentity } from "./identity.ts";

const SERVICE = "daemon";

const config = loadConfig();
const identity = loadOrCreateIdentity(config.DAEMON_IDENTITY_PATH);
const logger = createLogger({
	service: SERVICE,
	level: config.LOG_LEVEL,
	pretty: config.NODE_ENV === "development",
}).child({ nodeId: identity.nodeId });
const reporter = await initErrorReporting({
	dsn: config.SENTRY_DSN,
	service: SERVICE,
	environment: config.NODE_ENV,
	release: config.SERVICE_VERSION,
});

const stop = new AbortController();
const running = runHeartbeat(
	{
		orchestratorUrl: config.ORCHESTRATOR_URL,
		token: config.ORCHESTRATOR_DAEMON_TOKEN,
		intervalMs: config.DAEMON_HEARTBEAT_MS,
		logger,
	},
	stop.signal,
);
logger.info({ orchestrator: config.ORCHESTRATOR_URL }, "daemon started");

onShutdown(
	[
		{
			name: "heartbeat",
			run: async () => {
				stop.abort();
				await running;
			},
		},
		{ name: "error reporting", run: () => reporter.flush() },
	],
	{ logger },
);
