import {
	cachedMints,
	jupiterPrices,
	jupiterRouter,
	rpcAccountReader,
	rpcBalanceReader,
	solanaRpc,
} from "@maschina/solana";
import { createLogger, initErrorReporting, onShutdown } from "@maschina/telemetry";
import { loadConfig } from "./config.ts";
import { runHeartbeat } from "./heartbeat.ts";
import { loadOrCreateIdentity } from "./identity.ts";
import { NODE_KINDS } from "./kinds.ts";
import { machineRunner } from "./machine-runner.ts";
import { orchestratorClient } from "./orchestrator-client.ts";
import { solanaMarket } from "./solana-market.ts";
import { runWorkLoop } from "./work-loop.ts";

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

const orchestrator = orchestratorClient({
	url: config.ORCHESTRATOR_URL,
	token: config.ORCHESTRATOR_DAEMON_TOKEN,
});

const rpc = solanaRpc(config.SOLANA_RPC_URL);
const key = config.JUPITER_API_KEY;
const market = solanaMarket({
	router: jupiterRouter(key ? { apiKey: key } : {}),
	prices: jupiterPrices(key ? { apiKey: key } : {}),
	mints: cachedMints(rpcAccountReader(rpc)),
	balances: rpcBalanceReader(rpc),
	priorityFee: { maxLamports: config.DAEMON_PRIORITY_FEE_LAMPORTS, level: "high" },
});

const stop = new AbortController();
const beating = runHeartbeat(
	{
		orchestratorUrl: config.ORCHESTRATOR_URL,
		token: config.ORCHESTRATOR_DAEMON_TOKEN,
		intervalMs: config.DAEMON_HEARTBEAT_MS,
		logger,
	},
	stop.signal,
);
const working = runWorkLoop(
	{
		orchestrator,
		nodeId: identity.nodeId,
		execute: machineRunner({
			nodeId: identity.nodeId,
			// The kinds this node can run. A machine of any other kind is left for a node that knows it.
			kinds: NODE_KINDS,
			context: orchestrator.context,
			balances: market.balances,
			quote: market.quote,
			prepare: market.prepare,
			propose: orchestrator.propose,
			simulate: orchestrator.simulate,
			now: () => new Date(),
		}),
		logger,
		pollMs: config.DAEMON_POLL_MS,
		renewEveryMs: config.DAEMON_RENEW_MS,
		sleep: (ms, signal) =>
			new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, ms);
				signal.addEventListener(
					"abort",
					() => {
						clearTimeout(timer);
						resolve();
					},
					{ once: true },
				);
			}),
	},
	stop.signal,
);
logger.info({ orchestrator: config.ORCHESTRATOR_URL }, "daemon started");

onShutdown(
	[
		{
			// A run already under way finishes and is reported before the daemon exits.
			name: "work",
			run: async () => {
				stop.abort();
				await Promise.all([working, beating]);
			},
		},
		{ name: "error reporting", run: () => reporter.flush() },
	],
	{ logger },
);
