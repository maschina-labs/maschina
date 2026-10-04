import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ErrorBody, NewsResponse } from "@maschina/contracts";
import type { Clock } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import type { NewsDesk } from "../news.ts";

const latest = createRoute({
	method: "get",
	path: "/news",
	tags: ["News"],
	summary: "The latest headlines from across Solana and crypto, newest first",
	request: {
		query: z.object({
			/** Everything, or only the stories about Solana. */
			about: z.enum(["all", "solana"]).default("all"),
		}),
	},
	responses: {
		200: {
			description: "The news, as last read from the publishers' feeds",
			content: { "application/json": { schema: NewsResponse } },
		},
		400: {
			description: "A topic that is not offered",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

export function newsRoutes(desk: NewsDesk | undefined, clock: Clock) {
	return new OpenAPIHono<ServiceEnv>().openapi(latest, async (c) => {
		const { about } = c.req.valid("query");
		// Not set up here: no feeds, so no news, rather than an error a page has to explain.
		const news = desk ? await desk.latest() : { items: [], fetchedAt: clock.now().toISOString() };
		const items = about === "solana" ? news.items.filter((each) => each.solana) : news.items;
		c.header("cache-control", "public, max-age=60");
		return c.json({ items, fetchedAt: news.fetchedAt }, 200);
	});
}
