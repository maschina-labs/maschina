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
