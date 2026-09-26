import { err, MaschinaError, newId, ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import type { LeasedRun, RunQueue } from "./claim-route.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });

function app(runs: RunQueue) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [],
		runs,
		reports: { report: async () => ok(undefined) },
		contexts: { contextFor: async () => undefined },
		leases: { holds: async () => undefined },
		signer: {
			sign: async () => {
				throw new Error("not used here");
			},
		},
		paperSigner: {
			sign: async () => ({
				status: "refused" as const,
				proposalId: "01a0da00-0000-7000-8000-000000000000",
				by: "maschina" as const,
				rule: "not used here",
				reason: "not used here",
			}),
		},
		renewals: { renew: async () => ok(new Date()) },
	});
}

const claim = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/claim", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});

const nodeId = newId<"node">();

describe("claiming a run", () => {
	it("hands a node the run the queue leased to it", async () => {
		const run: LeasedRun = {
			id: newId<"run">(),
			machineId: newId<"machine">(),
			occurrenceKey: "2026-09-19T09:00:00Z",
			dueAt: new Date("2026-09-19T09:00:00Z"),
			leaseEpoch: 3n,
			leaseExpiresAt: new Date("2026-09-19T09:01:00Z"),
		};
		const asked: string[] = [];
		const res = await claim(
			app({
				claim: async (who) => {
					asked.push(who);
					return ok(run);
				},
			}),
			{ nodeId },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			run: {
				id: run.id,
				machineId: run.machineId,
				occurrenceKey: run.occurrenceKey,
				dueAt: "2026-09-19T09:00:00.000Z",
				leaseEpoch: "3",
				leaseExpiresAt: "2026-09-19T09:01:00.000Z",
			},
		});
		expect(asked).toEqual([nodeId]);
	});

	it("returns nothing, not an error, when no run is due", async () => {
		const res = await claim(app({ claim: async () => ok(undefined) }), { nodeId });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ run: null });
	});

	it("refuses a claim that does not name a node", async () => {
		const queue: RunQueue = {
			claim: async () => {
				throw new Error("the queue must not be asked");
			},
		};
		expect((await claim(app(queue), { nodeId: "someone" })).status).toBe(400);
		expect((await claim(app(queue), { nodeId, extra: true })).status).toBe(400);
		expect((await claim(app(queue), "not json")).status).toBe(400);
	});

	it("passes on a failure from the queue", async () => {
		const res = await claim(
			app({ claim: async () => err(new MaschinaError("invalid_input", "bad lease")) }),
			{ nodeId },
		);
		expect(res.status).toBe(400);
	});

	it("is closed to anyone without the daemon token", async () => {
		const res = await app({ claim: async () => ok(undefined) }).request("/internal/v1/runs/claim", {
			method: "POST",
			body: JSON.stringify({ nodeId }),
		});
		expect(res.status).toBe(401);
	});
});
