/**
 * The manager's own settings: the owner's AI key, set, checked and removed.
 *
 * A key is tried against Anthropic before it is kept, so a typo is caught here and not the first time the
 * manager is asked something. It is never sent back: the answer is only whether one is set, and its last
 * four characters.
 */

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorBody, ManagerKeyStatus, SetManagerKeyRequest } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import type { Owner } from "./machines.ts";

export type ManagerPorts = {
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	keyStatus(ownerId: string): Promise<ManagerKeyStatus>;
	/** Checks the key with Anthropic, then keeps it. Throws when Anthropic will not take it. */
	setKey(ownerId: string, key: string): Promise<ManagerKeyStatus>;
	clearKey(ownerId: string): Promise<void>;
};

const problem = {
	400: {
		description: "The request is not valid",
		content: { "application/json": { schema: ErrorBody } },
	},
	401: {
		description: "Nobody is signed in",
		content: { "application/json": { schema: ErrorBody } },
	},
};

const status = createRoute({
	method: "get",
	path: "/manager/key",
	tags: ["Manager"],
	summary: "Whether your AI key is set",
	responses: {
		200: {
			description: "Its status",
			content: { "application/json": { schema: ManagerKeyStatus } },
		},
		...problem,
	},
});

const set = createRoute({
	method: "put",
	path: "/manager/key",
	tags: ["Manager"],
	summary: "Set your AI key",
	description:
		"Tried against Anthropic first, then kept sealed. It is never sent back: only its last four characters are.",
	request: { body: { content: { "application/json": { schema: SetManagerKeyRequest } } } },
	responses: {
		200: { description: "Kept", content: { "application/json": { schema: ManagerKeyStatus } } },
		...problem,
		503: {
			description: "Keys cannot be kept here yet",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

const clear = createRoute({
	method: "delete",
	path: "/manager/key",
	tags: ["Manager"],
	summary: "Remove your AI key",
	responses: {
		200: { description: "Removed", content: { "application/json": { schema: ManagerKeyStatus } } },
		...problem,
	},
});

export function managerRoutes(ports: ManagerPorts) {
	const owner = async (c: { req: { raw: Request } }) => {
		const who = await ports.ownerOf(c.req.raw.headers);
		if (!who) throw new MaschinaError("unauthenticated", "sign in first");
		return who;
	};

	return new OpenAPIHono<ServiceEnv>()
		.openapi(status, async (c) => {
			const who = await owner(c);
			return c.json(ManagerKeyStatus.parse(await ports.keyStatus(who.ownerId)), 200);
		})
		.openapi(set, async (c) => {
			const who = await owner(c);
			const { key } = c.req.valid("json");
			return c.json(ManagerKeyStatus.parse(await ports.setKey(who.ownerId, key)), 200);
		})
		.openapi(clear, async (c) => {
			const who = await owner(c);
			await ports.clearKey(who.ownerId);
			return c.json(ManagerKeyStatus.parse({ set: false }), 200);
		});
}
