/**
 * What a daemon does all day: ask for a run, say it started, run it, say how it ended, ask again.
 *
 * The order matters. A machine is only run after its start is in the record, so a node that lost the
 * run before it began never touches it. And every run ends in a report, including one that crashed,
 * because a run that just disappears leaves the record unfinished.
 */

import type { RunReportEvent } from "@maschina/contracts";
import type { Logger } from "@maschina/telemetry";
import { backoffDelay } from "./heartbeat.ts";
import type { ClaimedRun, Orchestrator } from "./orchestrator-client.ts";

type SkipReason = Extract<RunReportEvent, { type: "run.skipped" }>["payload"]["reason"];

/** How a run ended, as far as the daemon is concerned. */
type RunEnd =
	| { end: "finished"; failed: boolean }
	| { end: "skipped"; reason: SkipReason; detail?: string };

/**
 * Runs one machine for one claimed run. The machine itself lives behind this. `lost` aborts when the run
 * has moved to another node: whatever the machine was about to do, it must not do it.
 */
export type RunExecutor = (run: ClaimedRun, lost: AbortSignal) => Promise<RunEnd>;

export type WorkLoopOptions = {
	orchestrator: Pick<Orchestrator, "claim" | "report" | "renew">;
	nodeId: string;
	execute: RunExecutor;
	logger: Logger;
	/** How long to wait before asking again when there was nothing to do. */
	pollMs: number;
	/** How often to renew the lease while a run is working. Well inside the lease's length. */
	renewEveryMs: number;
	sleep: (ms: number, signal: AbortSignal) => Promise<void>;
};

function endingFor(run: ClaimedRun, ended: RunEnd, durationMs: number): RunReportEvent {
	if (ended.end === "skipped") {
		return {
			type: "run.skipped",
			payload: {
				runId: run.id,
				reason: ended.reason,
				...(ended.detail ? { detail: ended.detail.slice(0, 500) } : {}),
			},
		};
	}
	return {
		type: "run.finished",
		payload: { runId: run.id, outcome: ended.failed ? "failed" : "completed", durationMs },
	};
}

/** Runs until `signal` aborts. A run already under way is finished and reported first. */
export async function runWorkLoop(options: WorkLoopOptions, signal: AbortSignal): Promise<void> {
	const { orchestrator, nodeId, execute, logger, pollMs, renewEveryMs, sleep } = options;
	let failures = 0;

	while (!signal.aborted) {
		let run: ClaimedRun | undefined;
		try {
			run = await orchestrator.claim(nodeId);
			failures = 0;
		} catch (error) {
			failures++;
			const delay = backoffDelay(failures, { baseMs: 1_000, maxMs: 60_000 });
			logger.warn({ err: error, failures, retryInMs: delay }, "could not ask for work");
			await sleep(delay, signal);
			continue;
		}

		if (!run) {
			await sleep(pollMs, signal);
			continue;
		}

		const log = logger.child({ runId: run.id, machineId: run.machineId });
		const report = (event: RunReportEvent) =>
			orchestrator.report({ nodeId, runId: run.id, leaseEpoch: run.leaseEpoch, event });

		try {
			const started = await report({ type: "run.started", payload: { runId: run.id, nodeId } });
			if (!started.recorded) {
				log.warn("lost the run before it started; leaving it alone");
				continue;
			}

			const startedAt = Date.now();
			const lost = new AbortController();
			const beat = setInterval(() => {
				orchestrator
					.renew({ nodeId, runId: run.id, leaseEpoch: run.leaseEpoch })
					.then((renewed) => {
						if (renewed.held || lost.signal.aborted) return;
						log.warn("the run moved to another node; stopping it");
						lost.abort();
					})
					// One missed beat is an outage, not a lost run. The lease has room for several.
					.catch((error: unknown) => log.warn({ err: error }, "could not renew the lease"));
			}, renewEveryMs);

			let ended: RunEnd;
			try {
				ended = await execute(run, lost.signal);
			} catch (error) {
				log.error({ err: error }, "the run crashed");
				ended = { end: "finished", failed: true };
			} finally {
				clearInterval(beat);
			}

			const reported = await report(endingFor(run, ended, Date.now() - startedAt));
			if (!reported.recorded) log.warn("lost the run before its outcome was recorded");
			else log.info({ ended: ended.end }, "run reported");
		} catch (error) {
			// The orchestrator went away mid-run. The lease will lapse and another node will pick it up.
			log.error({ err: error }, "could not report on the run");
		}
	}
}
