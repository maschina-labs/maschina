import {
	appendEvent,
	createDatabase,
	machineForWithdrawal,
	signerRecord,
	withdrawalSubmission,
} from "@maschina/db";
import { startServer } from "@maschina/service";
import { parseAddress, solanaRpc } from "@maschina/solana";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { signerUserIdFor, turnkeyApi, turnkeyProvider } from "@maschina/wallet";
import { buildApp, SERVICE } from "./app.ts";
import { tradeSigner, withdrawer } from "./compose.ts";
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

const signingKey = {
	apiBaseUrl: config.TURNKEY_API_BASE_URL,
	organizationId: config.TURNKEY_ORGANIZATION_ID,
	apiPublicKey: config.TURNKEY_SIGNER_API_PUBLIC_KEY,
	apiPrivateKey: config.TURNKEY_SIGNER_API_PRIVATE_KEY,
};
const signingKeyApi = turnkeyApi(signingKey);
const provider = turnkeyProvider({
	// The running signer holds no admin key. Anything administrative it is asked to do is refused by
	// Turnkey, because the signing key has no such permission.
	admin: signingKeyApi,
	signer: signingKeyApi,
	signerUserId: await signerUserIdFor(signingKey),
});

startServer({
	app: buildApp({
		version: config.SERVICE_VERSION,
		orchestratorToken: config.SIGNER_ORCHESTRATOR_TOKEN,
		logger,
		reporter,
		signer: tradeSigner({
			record: signerRecord(database.db, { feeAllowance: config.SIGNER_FEE_ALLOWANCE_LAMPORTS }),
			provider,
			rpc: solanaRpc(config.SOLANA_RPC_URL),
		}),
		withdrawer: withdrawer({
			record: {
				machineFor: async (machineId) => {
					const machine = await machineForWithdrawal(database.db, machineId);
					if (!machine) return undefined;
					// Parsed here, at the boundary: an address out of the database is still only text until
					// something checks it, and this is the last place before one is paid.
					return {
						wallet: parseAddress(machine.wallet),
						ownerWallet: parseAddress(machine.ownerWallet),
						providerWalletId: machine.providerWalletId,
					};
				},
				record: async (event) => {
					// A withdrawal is not held under anybody's lease: an owner asked for it, not a node.
					const written = await appendEvent(database.db, { ...event, leaseEpoch: 0n });
					if (!written.ok) throw written.error;
				},
				submissionFor: (machineId, withdrawalId) =>
					withdrawalSubmission(database.db, machineId, withdrawalId),
			},
			provider,
			rpc: solanaRpc(config.SOLANA_RPC_URL),
		}),
	}),
	port: config.SIGNER_PORT,
	logger,
	shutdown: [
		{ name: "database", run: database.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
