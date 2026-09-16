import {
	createServiceApp,
	type ReadinessCheck,
	registerHealth,
	requireServiceToken,
} from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";

export type OrchestratorDeps = {
	version: string;
	daemonToken: string;
	logger: Logger;
	reporter?: ErrorReporter | undefined;
	checks: ReadinessCheck[];
};

export const SERVICE = "orchestrator";

export function buildApp(deps: OrchestratorDeps) {
	const app = createServiceApp({
		service: SERVICE,
		logger: deps.logger,
		reporter: deps.reporter,
	});
	registerHealth(app, { service: SERVICE, version: deps.version, checks: deps.checks });

	// Everything daemons call lives under /internal and needs the daemon token.
	app.use("/internal/*", requireServiceToken(deps.daemonToken));
	app.get("/internal/v1/hello", (c) => c.json({ service: SERVICE, version: deps.version }));

	return app;
}
