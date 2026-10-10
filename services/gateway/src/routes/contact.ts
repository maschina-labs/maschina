import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ContactMessage, ContactReceipt, ErrorBody } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import type { ContactDesk } from "../contact.ts";

const send = createRoute({
	method: "post",
	path: "/contact",
	tags: ["Public"],
	summary: "Send a message to Maschina Labs",
	description:
		"Open to everyone. The message goes by email to the address for its topic, and a reply goes to the sender. Security problems are reported through the disclosure page, not here.",
	request: { body: { content: { "application/json": { schema: ContactMessage } } } },
	responses: {
		200: {
			description: "The message was sent",
			content: { "application/json": { schema: ContactReceipt } },
		},
		400: {
			description: "Not a valid message",
			content: { "application/json": { schema: ErrorBody } },
		},
		429: {
			description: "Too many messages",
			content: { "application/json": { schema: ErrorBody } },
		},
		503: {
			description: "Mail is not available",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

export function contactRoutes(desk: ContactDesk | undefined) {
	return new OpenAPIHono<ServiceEnv>().openapi(send, async (c) => {
		const message = c.req.valid("json");
		// A program that fills the hidden field is told it worked and nothing is sent, so it learns nothing.
		if (message.website) return c.json({ sent: true as const }, 200);
		// Not set up here: say so, rather than let a person believe a message went.
		if (!desk) throw new MaschinaError("unavailable", "messages cannot be sent from here yet");
		await desk.send(message);
		return c.json({ sent: true as const }, 200);
	});
}
