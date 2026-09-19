import { claimDueRun, createDatabase, reportRun, runContext } from "@maschina/db";
import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";

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
const database = createDatabase({ url: config.DATABASE_URL, applicationName: SERVICE });

const app = buildApp({
	version: config.SERVICE_VERSION,
	daemonToken: config.ORCHESTRATOR_DAEMON_TOKEN,
	logger,
	reporter,
	checks: [{ name: "database", check: database.ping }],
	runs: {
		claim: (nodeId) =>
			claimDueRun(database.db, {
				nodeId,
				now: new Date(),
				leaseSeconds: config.ORCHESTRATOR_LEASE_SECONDS,
			}),
	},
	reports: {
		report: (report) => reportRun(database.db, { ...report, now: new Date() }),
	},
	contexts: {
		contextFor: (lease) => runContext(database.db, { ...lease, now: new Date() }),
	},
});

startServer({
	app,
	port: config.ORCHESTRATOR_PORT,
	logger,
	shutdown: [
		{ name: "database", run: database.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
