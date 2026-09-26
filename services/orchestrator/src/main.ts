import {
	appendEvent,
	claimDueRun,
	createDatabase,
	holdsRun,
	machinesWatchingPrices,
	queueRun,
	renewLease,
	reportRun,
	runContext,
} from "@maschina/db";
import { KNOWN_KINDS } from "@maschina/runtime";
import { startServer } from "@maschina/service";
import { jupiterPrices, parseAddress } from "@maschina/solana";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";
import { paperSigner } from "./paper-signer.ts";
import { watchPrices } from "./price-watcher.ts";
import { signerClient } from "./signer-client.ts";

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
	leases: { holds: (lease) => holdsRun(database.db, { ...lease, now: new Date() }) },
	signer: signerClient({ url: config.SIGNER_URL, token: config.SIGNER_ORCHESTRATOR_TOKEN }),
	// A machine on paper is judged here instead, and the signer never hears about it.
	paperSigner: paperSigner({ record: (event) => appendEvent(database.db, event) }),
	renewals: {
		renew: (lease) =>
			renewLease(database.db, {
				...lease,
				now: new Date(),
				leaseSeconds: config.ORCHESTRATOR_LEASE_SECONDS,
			}),
	},
});

// Machines waiting on a level cannot watch prices themselves, so the orchestrator watches for them and
// queues a run when one crosses.
const watching = new AbortController();
const key = config.JUPITER_API_KEY;
const prices = jupiterPrices(key ? { apiKey: key } : {});
const watcher = watchPrices(
	{
		kinds: KNOWN_KINDS,
		watching: () => machinesWatchingPrices(database.db),
		pricesFor: async (mints) => {
			const priced = await prices.usdPrices(mints.map((mint) => parseAddress(mint)));
			return new Map([...priced].map(([mint, price]) => [String(mint), price.micros]));
		},
		queue: async (run) => {
			const queued = await queueRun(database.db, run);
			if (!queued.ok) throw queued.error;
		},
		logger,
		now: () => new Date(),
		everyMs: config.ORCHESTRATOR_PRICE_EVERY_MS,
	},
	watching.signal,
);

startServer({
	app,
	port: config.ORCHESTRATOR_PORT,
	logger,
	shutdown: [
		{
			name: "price watcher",
			run: async () => {
				watching.abort();
				await watcher;
			},
		},
		{ name: "database", run: database.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
