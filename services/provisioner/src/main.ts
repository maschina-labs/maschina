import { createDatabase, writeMachine } from "@maschina/db";
import { startServer } from "@maschina/service";
import { createLogger, initErrorReporting } from "@maschina/telemetry";
import { signerUserIdFor, turnkeyApi, turnkeyProvider } from "@maschina/wallet";
import { buildApp, SERVICE } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createMachine } from "./create-machine.ts";

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

const turnkey = (publicKey: string, privateKey: string) => ({
	apiBaseUrl: config.TURNKEY_API_BASE_URL,
	organizationId: config.TURNKEY_ORGANIZATION_ID,
	apiPublicKey: publicKey,
	apiPrivateKey: privateKey,
});

/** Creates wallets and writes policies. This service is the only one that holds it. */
const admin = turnkey(config.TURNKEY_API_PUBLIC_KEY, config.TURNKEY_API_PRIVATE_KEY);
/** Named in every policy as the only approver, so the signer's key is the only one that can sign. */
const signing = turnkey(
	config.TURNKEY_SIGNER_API_PUBLIC_KEY,
	config.TURNKEY_SIGNER_API_PRIVATE_KEY,
);

const provider = turnkeyProvider({
	admin: turnkeyApi(admin),
	signer: turnkeyApi(signing),
	signerUserId: await signerUserIdFor(signing),
});

startServer({
	app: buildApp({
		version: config.SERVICE_VERSION,
		gatewayToken: config.PROVISIONER_GATEWAY_TOKEN,
		logger,
		reporter,
		checks: [{ name: "database", check: database.ping }],
		provisioner: {
			create: (request) =>
				createMachine(
					{ provider, write: (machine) => writeMachine(database.db, machine) },
					request,
				),
		},
	}),
	port: config.PROVISIONER_PORT,
	logger,
	shutdown: [
		{ name: "database", run: database.close },
		{ name: "error reporting", run: () => reporter.flush() },
	],
});
