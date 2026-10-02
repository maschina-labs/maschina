import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorBody, StatusResponse } from "@maschina/contracts";
import type { Clock } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";

const status = createRoute({
	method: "get",
	path: "/status",
	tags: ["System"],
	summary: "Whether the API is up, and whether the stop switch is on",
	responses: {
		200: {
			description: "The API is up",
			content: { "application/json": { schema: StatusResponse } },
		},
		500: {
			description: "Unexpected error",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

/** The halt in force, if any: why, and since when. */
export type HaltReader = () => Promise<{ reason: string; since: Date } | undefined>;

export function systemRoutes(options: {
	version: string;
	clock: Clock;
	halt?: HaltReader | undefined;
}) {
	return new OpenAPIHono<ServiceEnv>().openapi(status, async (c) => {
		const halt = options.halt ? await options.halt() : undefined;
		return c.json(
			{
				status: "ok" as const,
				service: "gateway",
				version: options.version,
				time: options.clock.now().toISOString(),
				...(halt ? { halt: { reason: halt.reason, since: halt.since.toISOString() } } : {}),
			},
			200,
		);
	});
}
