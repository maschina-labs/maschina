import {
	createServiceApp,
	type ReadinessCheck,
	registerHealth,
	requireServiceToken,
} from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";
import { type Sweeper, signRoutes, type TradeSigner, type Withdrawer } from "./sign-route.ts";

export type SignerDeps = {
	version: string;
	orchestratorToken: string;
	logger: Logger;
	reporter?: ErrorReporter | undefined;
	/** What signs. Everything about how a trade is judged lives behind this. */
	signer: TradeSigner;
	/** What returns a machine's funds to its owner. */
	withdrawer: Withdrawer;
	/** What the signer needs to reach before it is any use: the record, and the chain. */
	checks?: ReadinessCheck[];
	/** What banks a machine's profit in its vault. */
	sweeper: Sweeper;
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
	registerHealth(app, { service: SERVICE, version: deps.version, checks: deps.checks ?? [] });

	// Everything below this line is the orchestrator's alone. There is no public route on the signer.
	app.use("/internal/*", requireServiceToken(deps.orchestratorToken));
	app.get("/internal/v1/hello", (c) => c.json({ service: SERVICE, version: deps.version }));
	app.route("/internal/v1", signRoutes(deps.signer, deps.withdrawer, deps.sweeper));

	return app;
}
