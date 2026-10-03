/**
 * The manager's own settings: the owner's AI key, set, checked and removed.
 *
 * A key is tried against Anthropic before it is kept, so a typo is caught here and not the first time the
 * manager is asked something. It is never sent back: the answer is only whether one is set, and its last
 * four characters.
 */

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	ErrorBody,
	ManagerKeyStatus,
	ManagerMessageRequest,
	ManagerMessageResponse,
	SetManagerKeyRequest,
	StartTraderRequest,
	TraderStatus,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import type { Owner } from "./machines.ts";

export type ManagerPorts = {
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	keyStatus(ownerId: string): Promise<ManagerKeyStatus>;
	/** Checks the key with Anthropic, then keeps it. Throws when Anthropic will not take it. */
	setKey(ownerId: string, key: string): Promise<ManagerKeyStatus>;
	clearKey(ownerId: string): Promise<void>;
	/** One turn of conversation, thought through on the owner's own key. */
	ask(
		ownerId: string,
		messages: ManagerMessageRequest["messages"],
		choice: { model: ManagerMessageRequest["model"]; effort: ManagerMessageRequest["effort"] },
	): Promise<ManagerMessageResponse & { steps?: { stopReason: string; blocks: string[] }[] }>;
	/** The owner's paper AI trader: its newest run, starting one, and stopping it. */
	trader(ownerId: string): Promise<TraderStatus>;
	startTrader(ownerId: string, cashUsd: number): Promise<TraderStatus>;
	stopTrader(ownerId: string): Promise<TraderStatus>;
};

/** A gateway with nowhere to keep keys: signed in owners are told so, rather than shown nothing. */
export function noManager(ownerOf: ManagerPorts["ownerOf"]): ManagerPorts {
	const unavailable = async (): Promise<never> => {
		throw new MaschinaError("unavailable", "the manager is not available here yet");
	};
	return {
		ownerOf,
		keyStatus: unavailable,
		setKey: unavailable,
		clearKey: unavailable,
		ask: unavailable,
		trader: unavailable,
		startTrader: unavailable,
		stopTrader: unavailable,
	};
}

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

const ask = createRoute({
	method: "post",
	path: "/manager/messages",
	tags: ["Manager"],
	summary: "Ask your manager",
	description:
		"The whole conversation goes in each time and nothing is kept between turns. It runs on your own key, and the answer says what it cost.",
	request: { body: { content: { "application/json": { schema: ManagerMessageRequest } } } },
	responses: {
		200: {
			description: "Its answer",
			content: { "application/json": { schema: ManagerMessageResponse } },
		},
		...problem,
		409: {
			description: "No AI key is set",
			content: { "application/json": { schema: ErrorBody } },
		},
		429: {
			description: "Your Anthropic credit ran out, or the key is being limited",
			content: { "application/json": { schema: ErrorBody } },
		},
		503: {
			description: "Claude could not be reached",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

const traderStatus = createRoute({
	method: "get",
	path: "/manager/trader",
	tags: ["Manager"],
	summary: "Your AI trader's newest run",
	responses: {
		200: {
			description: "The run, or none",
			content: { "application/json": { schema: TraderStatus } },
		},
		...problem,
	},
});

const traderStart = createRoute({
	method: "post",
	path: "/manager/trader",
	tags: ["Manager"],
	summary: "Start a paper AI trader",
	description:
		"Paper: real prices and real quotes, pretend money. It trades on its own inside limits it cannot change, and thinks on your key. Only one runs at a time; asking again returns the one running.",
	request: { body: { content: { "application/json": { schema: StartTraderRequest } } } },
	responses: {
		200: { description: "The run", content: { "application/json": { schema: TraderStatus } } },
		...problem,
		409: {
			description: "No AI key is set",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

const traderStop = createRoute({
	method: "post",
	path: "/manager/trader/stop",
	tags: ["Manager"],
	summary: "Stop your AI trader",
	responses: {
		200: {
			description: "The stopped run",
			content: { "application/json": { schema: TraderStatus } },
		},
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
		})
		.openapi(ask, async (c) => {
			const who = await owner(c);
			const { messages, model, effort } = c.req.valid("json");
			const { steps, ...answer } = await ports.ask(who.ownerId, messages, { model, effort });
			// How each step ended and what it held, never what was said: enough to tell why an answer
			// came back empty or cut short.
			if (steps) c.get("logger").info({ steps, costUsd: answer.costUsd }, "manager turn");
			return c.json(ManagerMessageResponse.parse(answer), 200);
		})
		.openapi(traderStatus, async (c) => {
			const who = await owner(c);
			return c.json(TraderStatus.parse(await ports.trader(who.ownerId)), 200);
		})
		.openapi(traderStart, async (c) => {
			const who = await owner(c);
			const { cashUsd } = c.req.valid("json");
			return c.json(TraderStatus.parse(await ports.startTrader(who.ownerId, cashUsd)), 200);
		})
		.openapi(traderStop, async (c) => {
			const who = await owner(c);
			return c.json(TraderStatus.parse(await ports.stopTrader(who.ownerId)), 200);
		});
}
