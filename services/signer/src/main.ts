import { createDatabase, signerRecord } from "@maschina/db";
import { startServer } from "@maschina/service";
import { solanaRpc } from "@maschina/solana";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { buildApp, SERVICE } from "./app.ts";
import { tradeSigner } from "./compose.ts";
import { loadConfig } from "./config.ts";
import { turnkeyProvider } from "./provider/turnkey.ts";
import { signerUserIdFor, turnkeyApi } from "./provider/turnkey-client.ts";

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
	}),
	port: config.SIGNER_PORT,
	logger,
	shutdown: [
		{ name: "database", run: database.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
