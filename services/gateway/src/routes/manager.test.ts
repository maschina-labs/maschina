import { MaschinaError, newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";
import type { ManagerPorts } from "./manager.ts";

const logger = createLogger({ service: "test", level: "silent" });
const ownerId = newId<"owner">();
const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123";

function app(ports: Partial<ManagerPorts> = {}, offered = true) {
	const ownerOf = async (headers: Headers) =>
		headers.get("authorization") === "Bearer signed-in"
			? { ownerId, walletAddress: "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF" }
			: undefined;
	const manager: ManagerPorts = {
		ownerOf,
		keyStatus: async () => ({ set: false }),
		setKey: async (_owner, key) => ({
			set: true,
			hint: key.slice(-4),
			setAt: "2026-10-03T01:00:00.000Z",
		}),
		clearKey: async () => undefined,
		ask: async () => ({
			reply: "Range Finder is running.",
			costUsd: 0.0123,
			model: "Sonnet 5",
			seconds: 4.2,
			looked: [{ tool: "list_machines", ok: true }],
		}),
		...ports,
	};
	const unused = async () => {
		throw new Error("not used here");
	};
	return buildApp({
		version: "1.0.0",
		corsOrigins: ["http://localhost:3000"],
		logger,
		machines: {
			ownerOf,
			list: unused,
			read: unused,
			record: unused,
			act: unused,
			retune: unused,
			funding: unused,
			balances: unused,
			create: unused,
			withdrawEverything: unused,
		},
		auth: {
			challenge: unused,
			verify: unused,
			ownerOf,
			signOut: async () => undefined,
		},
		cookie: { secure: false },
		...(offered ? { manager } : {}),
	});
}

const signedIn = { authorization: "Bearer signed-in", "content-type": "application/json" };

describe("the manager's key", () => {
	it("says whether one is set", async () => {
		const res = await app().request("/v1/manager/key", { headers: signedIn });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ set: false });
	});

	it("keeps a key and answers with only its last four characters", async () => {
		const setKey = vi.fn(async (_owner: string, key: string) => ({
			set: true,
			hint: key.slice(-4),
		}));
		const res = await app({ setKey }).request("/v1/manager/key", {
			method: "PUT",
			headers: signedIn,
			body: JSON.stringify({ key: `  ${KEY} ` }),
		});
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).not.toContain("sk-ant");
		expect(JSON.parse(body)).toEqual({ set: true, hint: "0123" });
		// Pasted with spaces around it, kept without them.
		expect(setKey).toHaveBeenCalledWith(ownerId, KEY);
	});

	it("refuses something that is not an Anthropic key before asking anyone", async () => {
		const setKey = vi.fn();
		const res = await app({ setKey }).request("/v1/manager/key", {
			method: "PUT",
			headers: signedIn,
			body: JSON.stringify({ key: "hello" }),
		});
		expect(res.status).toBe(400);
		expect(setKey).not.toHaveBeenCalled();
	});

	it("passes on Anthropic refusing the key", async () => {
		const res = await app({
			setKey: async () => {
				throw new MaschinaError("invalid_input", "Anthropic did not accept that key");
			},
		}).request("/v1/manager/key", {
			method: "PUT",
			headers: signedIn,
			body: JSON.stringify({ key: KEY }),
		});
		expect(res.status).toBe(400);
		expect(await res.text()).toContain("Anthropic did not accept that key");
	});

	it("removes it", async () => {
		const clearKey = vi.fn(async () => undefined);
		const res = await app({ clearKey }).request("/v1/manager/key", {
			method: "DELETE",
			headers: signedIn,
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ set: false });
		expect(clearKey).toHaveBeenCalledWith(ownerId);
	});

	it("is nobody's business but a signed in owner's", async () => {
		for (const method of ["GET", "PUT", "DELETE"]) {
			const res = await app().request("/v1/manager/key", {
				method,
				headers: { "content-type": "application/json" },
				...(method === "PUT" ? { body: JSON.stringify({ key: KEY }) } : {}),
			});
			expect(res.status).toBe(401);
		}
	});
});

describe("a gateway with nowhere to keep keys", () => {
	it("tells a signed in owner the manager is not available", async () => {
		const res = await app({}, false).request("/v1/manager/key", { headers: signedIn });
		expect(res.status).toBe(503);
		expect(await res.text()).toContain("not available here yet");
	});
});

describe("asking the manager", () => {
	const ask = (body: unknown, ports: Partial<ManagerPorts> = {}) =>
		app(ports).request("/v1/manager/messages", {
			method: "POST",
			headers: signedIn,
			body: JSON.stringify(body),
		});

	it("answers with what it cost and what it looked at", async () => {
		const asked = vi.fn(async () => ({
			reply: "Fine.",
			costUsd: 0.01,
			model: "Sonnet 5",
			seconds: 3,
			looked: [],
		}));
		const res = await ask({ messages: [{ role: "you", text: " how are they? " }] }, { ask: asked });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			reply: "Fine.",
			costUsd: 0.01,
			model: "Sonnet 5",
			seconds: 3,
			looked: [],
		});
		// Sonnet at medium effort unless asked otherwise.
		expect(asked).toHaveBeenCalledWith(ownerId, [{ role: "you", text: "how are they?" }], {
			model: "sonnet",
			effort: "medium",
		});
	});

	it("takes the model and effort asked for, and nothing else", async () => {
		const asked = vi.fn(async () => ({
			reply: "ok",
			costUsd: 0,
			model: "Opus 5.5",
			seconds: 1,
			looked: [],
		}));
		const res = await ask(
			{ messages: [{ role: "you", text: "hi" }], model: "opus", effort: "high" },
			{ ask: asked },
		);
		expect(res.status).toBe(200);
		expect(asked).toHaveBeenCalledWith(ownerId, expect.anything(), {
			model: "opus",
			effort: "high",
		});
		expect((await ask({ messages: [{ role: "you", text: "hi" }], model: "gpt" })).status).toBe(400);
	});

	it("needs the last word to be yours", async () => {
		const res = await ask({ messages: [{ role: "manager", text: "hello" }] });
		expect(res.status).toBe(400);
	});

	it("refuses an empty or endless conversation", async () => {
		expect((await ask({ messages: [] })).status).toBe(400);
		const long = Array.from({ length: 61 }, () => ({ role: "you", text: "again" }));
		expect((await ask({ messages: long })).status).toBe(400);
	});

	it("says plainly when there is no key, or the credit ran out", async () => {
		const noKey = await ask(
			{ messages: [{ role: "you", text: "hi" }] },
			{
				ask: async () =>
					Promise.reject(new MaschinaError("conflict", "add your Anthropic key in settings first")),
			},
		);
		expect(noKey.status).toBe(409);
		const broke = await ask(
			{ messages: [{ role: "you", text: "hi" }] },
			{
				ask: async () =>
					Promise.reject(new MaschinaError("limit_exceeded", "Your Anthropic credit has run out")),
			},
		);
		expect(broke.status).toBe(429);
		expect(await broke.text()).toContain("credit has run out");
	});

	it("is only for a signed in owner", async () => {
		const res = await app().request("/v1/manager/messages", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ messages: [{ role: "you", text: "hi" }] }),
		});
		expect(res.status).toBe(401);
	});
});
