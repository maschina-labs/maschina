import { createServiceApp, registerHealth } from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";
import type { Platform } from "./platforms.ts";

export type BotsDeps = {
	version: string;
	platforms: Platform[];
	logger: Logger;
	reporter?: ErrorReporter | undefined;
};

export const SERVICE = "bots";

export function buildApp(deps: BotsDeps) {
	const app = createServiceApp({
		service: SERVICE,
		logger: deps.logger,
		reporter: deps.reporter,
	});
	registerHealth(app, { service: SERVICE, version: deps.version });
	app.get("/platforms", (c) => c.json({ enabled: deps.platforms }));
	return app;
}
