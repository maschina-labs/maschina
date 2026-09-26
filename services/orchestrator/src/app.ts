import {
	createServiceApp,
	type ReadinessCheck,
	registerHealth,
	requireServiceToken,
} from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";
import { claimRoutes, type RunQueue } from "./claim-route.ts";
import { contextRoutes, type RunContexts } from "./context-route.ts";
import { type Leases, proposeRoutes, type Signer, type Simulator } from "./propose-route.ts";
import { type LeaseRenewals, renewRoutes } from "./renew-route.ts";
import { type RunReports, reportRoutes } from "./report-route.ts";

export type OrchestratorDeps = {
	version: string;
	daemonToken: string;
	logger: Logger;
	reporter?: ErrorReporter | undefined;
	checks: ReadinessCheck[];
	runs: RunQueue;
	reports: RunReports;
	contexts: RunContexts;
	leases: Leases;
	signer: Signer;
	/** The same interface, for machines that only pretend to trade. */
	paperSigner: Simulator;
	renewals: LeaseRenewals;
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
	app.route("/internal/v1", claimRoutes(deps.runs));
	app.route("/internal/v1", reportRoutes(deps.reports));
	app.route("/internal/v1", contextRoutes(deps.contexts));
	app.route("/internal/v1", proposeRoutes(deps.leases, deps.signer, deps.paperSigner));
	app.route("/internal/v1", renewRoutes(deps.renewals));

	return app;
}
