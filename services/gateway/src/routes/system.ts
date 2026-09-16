import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorBody, HealthResponse } from "@maschina/contracts";
import type { Clock } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";

const status = createRoute({
	method: "get",
	path: "/status",
	tags: ["System"],
	summary: "Whether the API is up",
	responses: {
		200: {
			description: "The API is up",
			content: { "application/json": { schema: HealthResponse } },
		},
		500: {
			description: "Unexpected error",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

export function systemRoutes(options: { version: string; clock: Clock }) {
	return new OpenAPIHono<ServiceEnv>().openapi(status, (c) =>
		c.json(
			{
				status: "ok" as const,
				service: "gateway",
				version: options.version,
				time: options.clock.now().toISOString(),
			},
			200,
		),
	);
}
