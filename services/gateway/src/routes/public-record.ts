import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { PublicRecord, type PublicTrade } from "@maschina/contracts";
import type { ServiceEnv } from "@maschina/service";

/** What the public record needs: the finished trades of the one machine chosen to be shown. */
export type PublicRecordDesk = { read(): Promise<PublicTrade[]> };

const route = createRoute({
	method: "get",
	path: "/public/record",
	tags: ["Public"],
	summary: "The finished trades of the machine chosen to be shown, newest first",
	description:
		"Open to everyone. Each trade is its time, side, amounts and the signature that proves it on the chain, and nothing else: no machine, owner or wallet.",
	responses: {
		200: {
			description: "The trades",
			content: { "application/json": { schema: PublicRecord } },
		},
	},
});

export function publicRecordRoutes(desk: PublicRecordDesk | undefined) {
	return new OpenAPIHono<ServiceEnv>().openapi(route, async (c) => {
		// No machine chosen here: nothing to show, rather than an error a page has to explain.
		const trades = desk ? await desk.read() : [];
		c.header("cache-control", "public, max-age=30");
		// Parsed through the strict schema, so a field that should not be public fails here, not on a page.
		return c.json(PublicRecord.parse({ trades }), 200);
	});
}
