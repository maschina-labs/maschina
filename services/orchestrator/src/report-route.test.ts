import { err, MaschinaError, newId, ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import type { RunQueue } from "./claim-route.ts";
import type { RunReports, SubmittedReport } from "./report-route.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });
const queue: RunQueue = { claim: async () => ok(undefined) };

function app(reports: RunReports) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [],
		runs: queue,
		reports,
		contexts: { contextFor: async () => undefined },
		leases: { holds: async () => undefined },
		signer: {
			sign: async () => {
				throw new Error("not used here");
			},
		},
		renewals: { renew: async () => ok(new Date()) },
	});
}

const send = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/report", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});

const nodeId = newId<"node">();
const runId = newId<"run">();
const finished = {
	nodeId,
	runId,
	leaseEpoch: "4",
	event: { type: "run.finished", payload: { runId, outcome: "completed", durationMs: 900 } },
};

describe("reporting on a run", () => {
	it("hands a well formed report to the record, under the node's lease", async () => {
		const seen: SubmittedReport[] = [];
		const res = await send(
			app({
				report: async (report) => {
					seen.push(report);
					return ok(undefined);
				},
			}),
			finished,
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ recorded: true });
		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({ nodeId, runId, leaseEpoch: 4n, event: finished.event });
	});

	it("refuses a report once the node no longer holds the run", async () => {
		const res = await send(
			app({
				report: async () => err(new MaschinaError("conflict", "this node no longer holds the run")),
			}),
			finished,
		);
		expect(res.status).toBe(409);
	});

	it("refuses anything a node may not report, before the record is asked", async () => {
		const reports: RunReports = {
			report: async () => {
				throw new Error("the record must not be asked");
			},
		};
		const trade = { ...finished, event: { type: "trade.intended", payload: {} } };
		const unknownOutcome = {
			...finished,
			event: { type: "run.finished", payload: { runId, outcome: "great", durationMs: 1 } },
		};

		expect((await send(app(reports), trade)).status).toBe(400);
		expect((await send(app(reports), unknownOutcome)).status).toBe(400);
		expect((await send(app(reports), { ...finished, leaseEpoch: "-1" })).status).toBe(400);
		expect((await send(app(reports), "not json")).status).toBe(400);
	});
});
