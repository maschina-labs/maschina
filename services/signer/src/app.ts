import { createServiceApp, registerHealth, requireServiceToken } from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";

export type SignerDeps = {
	version: string;
	orchestratorToken: string;
	logger: Logger;
	reporter?: ErrorReporter | undefined;
};

export const SERVICE = "signer";

export function buildApp(deps: SignerDeps) {
	const app = createServiceApp({
		service: SERVICE,
		logger: deps.logger,
		// Signing requests are small. Anything large is a mistake or an attack.
		maxBodyBytes: 64 * 1024,
		reporter: deps.reporter,
	});
	registerHealth(app, { service: SERVICE, version: deps.version });

	app.use("/internal/*", requireServiceToken(deps.orchestratorToken));
	app.get("/internal/v1/hello", (c) => c.json({ service: SERVICE, version: deps.version }));

	return app;
}
