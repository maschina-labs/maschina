import { MaschinaError, newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { MachinePorts } from "./machines.ts";

const logger = createLogger({ service: "test", level: "silent" });
const SOL = "So11111111111111111111111111111111111111112";
const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const WALLET = "7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe";

const machineId = newId<"machine">();
const ownerId = newId<"owner">();

const summary = {
	machineId,
	name: "SOL dip buyer",
	kind: "price_trigger",
	walletAddress: WALLET,
	createdAt: "2026-09-21T09:00:00.000Z",
	state: "ready" as const,
	budget: { granted: "20000000", reserved: "0", settled: "0", available: "20000000" },
	result: {
		realised: "0",
		position: "0",
		basis: "0",
		feesLamports: "0",
		trades: 0,
		roundTrips: 0,
		wins: 0,
		losses: 0,
		simulated: false,
	},
};

const detail = {
	...summary,
	settings: { level: "142000000" },
	limits: { maxPerTrade: "5000000", approvedMints: [SOL] },
	actions: ["fund", "start", "stop"] as const,
};

function app(ports: Partial<MachinePorts> = {}) {
	const base: MachinePorts = {
		ownerOf: async (headers) =>
			headers.get("authorization") === "Bearer signed-in"
				? { ownerId, walletAddress: OWNER }
				: undefined,
		list: async () => [summary],
		read: async (_owner, id) => (id === machineId ? detail : undefined),
		record: async () => [
			{ id: newId<"event">(), type: "machine.created", occurredAt: summary.createdAt, payload: {} },
		],
		act: async () => ({ state: "running" }),
		create: async () => ({
			machineId,
			ownerId,
			walletAddress: WALLET,
			definitionId: "d".repeat(64),
		}),
	};
	return buildApp({
		version: "1.0.0",
		corsOrigins: ["http://localhost:3000"],
		logger,
		machines: { ...base, ...ports },
		// Signing in has its own tests; these reach the machines API with the session already decided.
		auth: {
			challenge: async () => ({ message: "", nonce: "", expiresAt: "" }),
			verify: async () => {
				throw new Error("not used here");
			},
			ownerOf: base.ownerOf,
			signOut: async () => undefined,
		},
		cookie: { secure: false },
	});
}

const signedIn = { authorization: "Bearer signed-in", "content-type": "application/json" };

describe("the machines API", () => {
	it("lists the machines you own", async () => {
		const res = await app().request("/v1/machines", { headers: signedIn });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ machines: [summary] });
	});

	it("reads one machine, with what you may do next", async () => {
		const res = await app().request(`/v1/machines/${machineId}`, { headers: signedIn });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ machineId, actions: ["fund", "start", "stop"] });
	});

	it("reads a machine's record", async () => {
		const res = await app().request(`/v1/machines/${machineId}/record?limit=10`, {
			headers: signedIn,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { events: unknown[] };
		expect(body.events).toHaveLength(1);
	});

	it("turns a machine that is not yours into a machine that does not exist", async () => {
		const other = newId<"machine">();
		const res = await app().request(`/v1/machines/${other}`, { headers: signedIn });
		expect(res.status).toBe(404);

		const theirRecord = await app().request(`/v1/machines/${other}/record`, { headers: signedIn });
		expect(theirRecord.status).toBe(404);
	});

	it("asks nobody anything when nobody is signed in", async () => {
		let asked = false;
		const watching = app({
			list: async () => {
				asked = true;
				return [];
			},
		});

		for (const path of [
			"/v1/machines",
			`/v1/machines/${machineId}`,
			`/v1/machines/${machineId}/record`,
		]) {
			expect((await watching.request(path)).status).toBe(401);
		}
		expect(asked).toBe(false);
	});

	it("starts a machine", async () => {
		const res = await app().request(`/v1/machines/${machineId}/actions`, {
			method: "POST",
			headers: signedIn,
			body: JSON.stringify({ action: "start" }),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ state: "running" });
	});

	it("passes on a move the machine cannot make", async () => {
		const res = await app({
			act: async () => {
				throw new MaschinaError("conflict", "a stopped machine never runs again");
			},
		}).request(`/v1/machines/${machineId}/actions`, {
			method: "POST",
			headers: signedIn,
			body: JSON.stringify({ action: "start" }),
		});
		expect(res.status).toBe(409);
	});

	it("refuses an action nobody has heard of", async () => {
		const res = await app().request(`/v1/machines/${machineId}/actions`, {
			method: "POST",
			headers: signedIn,
			body: JSON.stringify({ action: "self_destruct" }),
		});
		expect(res.status).toBe(400);
	});

	it("creates a machine for the wallet that signed in, never one named in the request", async () => {
		const asked: { ownerWallet: string }[] = [];
		const res = await app({
			create: async (request) => {
				asked.push(request);
				return { machineId, ownerId, walletAddress: WALLET, definitionId: "d".repeat(64) };
			},
		}).request("/v1/machines", {
			method: "POST",
			headers: signedIn,
			body: JSON.stringify({
				ownerWallet: "SomeoneE1se11111111111111111111111111111111",
				name: "SOL dip buyer",
				kind: "price_trigger",
				settings: { level: "142000000" },
				limits: { budgetGranted: "20000000", approvedMints: [SOL] },
			}),
		});

		// The request named somebody else's wallet, and the contract refuses the field outright.
		expect(res.status).toBe(400);
		expect(asked).toEqual([]);
	});

	it("creates a machine and says which wallet to fund", async () => {
		const asked: { ownerWallet: string }[] = [];
		const res = await app({
			create: async (request) => {
				asked.push(request);
				return { machineId, ownerId, walletAddress: WALLET, definitionId: "d".repeat(64) };
			},
		}).request("/v1/machines", {
			method: "POST",
			headers: signedIn,
			body: JSON.stringify({
				name: "SOL dip buyer",
				kind: "price_trigger",
				settings: { level: "142000000" },
				limits: { budgetGranted: "20000000", approvedMints: [SOL] },
			}),
		});

		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ walletAddress: WALLET });
		expect(asked[0]?.ownerWallet).toBe(OWNER);
	});
});
