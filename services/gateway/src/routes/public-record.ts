import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { PublicRecord } from "@maschina/contracts";
import type { ServiceEnv } from "@maschina/service";

/** What the public record needs: the finished trades of every machine the house owns. */
export type PublicRecordDesk = { read(): Promise<PublicRecord> };

const route = createRoute({
	method: "get",
	path: "/public/record",
	tags: ["Public"],
	summary: "Every finished trade the house's machines made, newest first, paper kept apart",
	description:
		"Open to everyone. Real money and paper are two separate lists and are never added together. A live trade carries the signature that proves it on the chain; a paper trade carries none, because nothing was signed. Each trade is its time, side and amounts, and nothing else: no machine, owner or wallet.",
	responses: {
		200: {
			description: "The trades",
			content: { "application/json": { schema: PublicRecord } },
		},
	},
});

export function publicRecordRoutes(desk: PublicRecordDesk | undefined) {
	return new OpenAPIHono<ServiceEnv>().openapi(route, async (c) => {
		// No owner chosen here: nothing to show, rather than an error a page has to explain.
		const record = desk ? await desk.read() : { live: [], paper: [], refused: [] };
		c.header("cache-control", "public, max-age=30");
		// Parsed through the strict schema, so a field that should not be public fails here, not on a page.
		return c.json(PublicRecord.parse(record), 200);
	});
}
