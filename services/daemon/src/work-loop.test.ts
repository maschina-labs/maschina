import type { RunReportEvent } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import type { ClaimedRun, Orchestrator } from "./orchestrator-client.ts";
import { type RunExecutor, runWorkLoop } from "./work-loop.ts";

const logger = createLogger({ service: "t", level: "silent" });
const nodeId = newId<"node">();

const aRun = (): ClaimedRun => ({
	id: newId<"run">(),
	machineId: newId<"machine">(),
	occurrenceKey: "2026-09-21T09:00",
	dueAt: new Date("2026-09-21T09:00:00Z"),
	leaseEpoch: 2n,
	leaseExpiresAt: new Date("2026-09-21T09:01:00Z"),
});

/** An orchestrator that hands out the given runs once each, then nothing, and keeps every report. */
function fakeOrchestrator(runs: ClaimedRun[], options: { lose?: boolean } = {}) {
	const queue = [...runs];
	const reports: RunReportEvent[] = [];
	const orchestrator: Orchestrator = {
		claim: async () => queue.shift(),
		report: async ({ event }) => {
			reports.push(event);
			return options.lose ? { recorded: false, reason: "lease_lost" } : { recorded: true };
		},
		renew: async () => ({ held: true }),
	};
	return { orchestrator, reports, remaining: () => queue.length };
}

/** Runs the loop until the queue is drained, then stops it. */
async function drain(orchestrator: Orchestrator, execute: RunExecutor, done: () => boolean) {
	const stop = new AbortController();
	const sleeps: number[] = [];
	await runWorkLoop(
		{
			orchestrator,
			nodeId,
			execute,
			logger,
			pollMs: 5_000,
			renewEveryMs: 20_000,
			sleep: async (ms) => {
				sleeps.push(ms);
				if (done()) stop.abort();
			},
		},
		stop.signal,
	);
	return sleeps;
}

describe("the daemon's work loop", () => {
	it("claims a run, reports it started, runs it, and reports how it finished", async () => {
		const run = aRun();
		const { orchestrator, reports, remaining } = fakeOrchestrator([run]);
		const ran: string[] = [];

		await drain(
			orchestrator,
			async (claimed) => {
				ran.push(claimed.id);
				return { end: "finished", failed: false };
			},
			() => remaining() === 0,
		);

		expect(ran).toEqual([run.id]);
		expect(reports.map((event) => event.type)).toEqual(["run.started", "run.finished"]);
		expect(reports[1]).toMatchObject({ payload: { runId: run.id, outcome: "completed" } });
	});

	it("takes the next run straight away, and waits only when there is nothing to do", async () => {
		const { orchestrator, remaining } = fakeOrchestrator([aRun(), aRun(), aRun()]);
		const sleeps = await drain(
			orchestrator,
			async () => ({ end: "finished", failed: false }),
			() => remaining() === 0,
		);
		expect(sleeps).toEqual([5_000]);
	});

	it("reports a skip with its reason", async () => {
		const { orchestrator, reports, remaining } = fakeOrchestrator([aRun()]);
		await drain(
			orchestrator,
			async () => ({ end: "skipped", reason: "machine_paused" }),
			() => remaining() === 0,
		);
		expect(reports[1]).toMatchObject({
			type: "run.skipped",
			payload: { reason: "machine_paused" },
		});
	});

	it("reports a run that threw as failed, and keeps going", async () => {
		const { orchestrator, reports, remaining } = fakeOrchestrator([aRun(), aRun()]);
		let calls = 0;
		await drain(
			orchestrator,
			async () => {
				calls++;
				if (calls === 1) throw new Error("the provider fell over");
				return { end: "finished", failed: false };
			},
			() => remaining() === 0,
		);
		const outcomes = reports
			.filter((event) => event.type === "run.finished")
			.map((event) => (event.type === "run.finished" ? event.payload.outcome : ""));
		expect(outcomes).toEqual(["failed", "completed"]);
	});

	it("does not run a machine whose start it could not record", async () => {
		const { orchestrator, remaining } = fakeOrchestrator([aRun()], { lose: true });
		let ran = false;
		await drain(
			orchestrator,
			async () => {
				ran = true;
				return { end: "finished", failed: false };
			},
			() => remaining() === 0,
		);
		expect(ran).toBe(false);
	});

	it("backs off when the orchestrator cannot be reached", async () => {
		let attempts = 0;
		const orchestrator: Orchestrator = {
			claim: async () => {
				attempts++;
				throw new Error("connection refused");
			},
			report: async () => ({ recorded: true }),
			renew: async () => ({ held: true }),
		};
		const sleeps = await drain(
			orchestrator,
			async () => ({ end: "finished", failed: false }),
			() => attempts >= 3,
		);
		expect(sleeps).toHaveLength(3);
		for (const ms of sleeps) expect(ms).toBeGreaterThanOrEqual(0);
	});

	it("does not start another run once asked to stop", async () => {
		const stop = new AbortController();
		stop.abort();
		const { orchestrator, remaining } = fakeOrchestrator([aRun()]);
		await runWorkLoop(
			{
				orchestrator,
				nodeId,
				execute: async () => ({ end: "finished", failed: false }),
				logger,
				pollMs: 5_000,
				renewEveryMs: 20_000,
				sleep: async () => {},
			},
			stop.signal,
		);
		expect(remaining()).toBe(1);
	});
});

describe("keeping the lease while a run works", () => {
	const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	it("renews on a beat for as long as the run is working", async () => {
		const { orchestrator, remaining } = fakeOrchestrator([aRun()]);
		let renewals = 0;
		orchestrator.renew = async () => {
			renewals++;
			return { held: true };
		};
		const stop = new AbortController();
		await runWorkLoop(
			{
				orchestrator,
				nodeId,
				// Waits for the beats rather than for the clock, so a busy machine cannot fail this.
				execute: async () => {
					while (renewals < 3) await pause(5);
					return { end: "finished", failed: false };
				},
				logger,
				pollMs: 5_000,
				renewEveryMs: 10,
				sleep: async () => {
					if (remaining() === 0) stop.abort();
				},
			},
			stop.signal,
		);
		expect(renewals).toBeGreaterThanOrEqual(3);
	});

	it("tells the machine to stop the moment the run has moved to another node", async () => {
		const { orchestrator, remaining } = fakeOrchestrator([aRun()]);
		orchestrator.renew = async () => ({ held: false });
		let sawStop = false;
		const stop = new AbortController();
		await runWorkLoop(
			{
				orchestrator,
				nodeId,
				execute: async (_run, lost) => {
					while (!lost.aborted) await pause(5);
					sawStop = lost.aborted;
					return { end: "finished", failed: false };
				},
				logger,
				pollMs: 5_000,
				renewEveryMs: 10,
				sleep: async () => {
					if (remaining() === 0) stop.abort();
				},
			},
			stop.signal,
		);
		expect(sawStop).toBe(true);
	});
});
