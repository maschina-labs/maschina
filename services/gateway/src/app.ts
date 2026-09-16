import { OpenAPIHono } from "@hono/zod-openapi";
import { type Clock, systemClock } from "@maschina/core";
import { createServiceApp, rateLimit, registerHealth } from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { systemRoutes } from "./routes/system.ts";

export type GatewayDeps = {
	version: string;
	corsOrigins: string[];
	logger: Logger;
	reporter?: ErrorReporter | undefined;
	clock?: Clock | undefined;
};

export const SERVICE = "gateway";

/** The client address, as reported by the platform in front of the gateway. */
export function clientKey(c: Context): string {
	return (
		c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
	);
}

/** Every versioned route. */
function v1(deps: GatewayDeps) {
	return new OpenAPIHono().route(
		"/",
		systemRoutes({ version: deps.version, clock: deps.clock ?? systemClock }),
	);
}

export function buildApp(deps: GatewayDeps) {
	const app = createServiceApp({
		service: SERVICE,
		logger: deps.logger,
		reporter: deps.reporter,
	});

	app.use(
		cors({
			origin: deps.corsOrigins,
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
			allowHeaders: ["content-type", "authorization", "x-request-id"],
			exposeHeaders: ["x-request-id", "retry-after"],
			credentials: true,
			maxAge: 600,
		}),
	);
	app.use(
		"/v1/*",
		rateLimit({
			capacity: 60,
			refillPerSecond: 2,
			key: clientKey,
			clock: deps.clock ?? systemClock,
		}),
	);

	registerHealth(app, { service: SERVICE, version: deps.version });

	const api = v1(deps);

	app.get("/openapi.json", (c) =>
		c.json(
			api.getOpenAPI31Document({
				openapi: "3.1.0",
				info: { title: "Maschina API", version: deps.version },
				servers: [{ url: "/v1" }],
			}),
		),
	);

	return app.route("/v1", api);
}

/** The full typed shape of the API, for clients. */
export type GatewayApp = ReturnType<typeof buildApp>;
