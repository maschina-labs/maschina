import { newId, ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import type { RunContexts } from "./context-route.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });

function app(contexts: RunContexts) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [],
		runs: { claim: async () => ok(undefined) },
		reports: { report: async () => ok(undefined) },
		contexts,
		leases: { holds: async () => undefined },
		signer: {
			sign: async () => {
				throw new Error("not used here");
			},
		},
	});
}

const ask = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/context", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const nodeId = newId<"node">();
const runId = newId<"run">();
const machineId = newId<"machine">();

describe("a node asking about its run", () => {
	it("is told what it needs to run the machine, with amounts as digits", async () => {
		const res = await ask(
			app({
				contextFor: async (lease) => ({
					runId: lease.runId,
					machineId,
					wallet: "WaLLet1111111111111111111111111111111111111",
					kind: "recurring_buy",
					settings: { amountPerBuy: "5" },
					dueAt: new Date("2026-09-21T09:00:00Z"),
					state: "running",
					canAct: true,
					availableBudget: 20_000_000n,
					totals: { spent: 0n, buys: 0 },
				}),
			}),
			{ nodeId, runId, leaseEpoch: "2" },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			runId,
			machineId,
			kind: "recurring_buy",
			settings: { amountPerBuy: "5" },
			dueAt: "2026-09-21T09:00:00.000Z",
			canAct: true,
			availableBudget: "20000000",
			totals: { spent: "0", buys: 0 },
		});
	});

	it("is refused when it no longer holds the run", async () => {
		const res = await ask(app({ contextFor: async () => undefined }), {
			nodeId,
			runId,
			leaseEpoch: "2",
		});
		expect(res.status).toBe(409);
	});

	it("is refused when the question is malformed", async () => {
		const contexts: RunContexts = {
			contextFor: async () => {
				throw new Error("must not be asked");
			},
		};
		expect((await ask(app(contexts), { nodeId, runId })).status).toBe(400);
	});
});
