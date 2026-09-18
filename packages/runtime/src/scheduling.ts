/**
 * Deciding which runs to queue.
 *
 * This is the pure half of the scheduler: given what a machine is, when it last ran and what time it is
 * now, it says which occurrences should be queued and which were missed. The orchestrator does the
 * writing; this decides, so the decision can be tested exhaustively without a database or a clock.
 *
 * The rules, from D-068:
 *
 *   - Only a running machine gets runs. Draft, ready, paused and stopped machines get none.
 *   - An occurrence that is due now is queued.
 *   - An occurrence that was missed is queued late **only** inside its grace period.
 *   - Missed runs never pile up: at most one catch-up, however long the outage.
 *   - A skipped occurrence is reported with its reason, so the record can say what happened and why.
 */

import { nextOccurrence, type Schedule } from "@maschina/rules";
import type { MachineState } from "./machine-state.ts";

export type SchedulingMachine = {
	machineId: string;
	state: MachineState;
	schedule: Schedule;
	/** When the scheduler last looked at this machine. Occurrences before this are already handled. */
	lastCheckedAt: Date;
	/** How late a run may be and still happen. Defaults to an hour. */
	graceSeconds?: number;
};

export type PlannedRun = {
	machineId: string;
	/** The occurrence, as a stable key: the same moment always gives the same key. */
	occurrenceKey: string;
	dueAt: Date;
	/** How late this run already is, in seconds. Zero when it is due now. */
	lateBySeconds: number;
};

export type SkippedRun = {
	machineId: string;
	occurrenceKey: string;
	dueAt: Date;
	reason: "missed_window" | "machine_paused" | "machine_stopped";
	lateBySeconds: number;
};

export type SchedulingPlan = { queue: PlannedRun[]; skip: SkippedRun[] };

export const DEFAULT_GRACE_SECONDS = 60 * 60;

/** The occurrence key: the moment itself, to the minute, in UTC. Stable and readable in the record. */
export const occurrenceKeyFor = (dueAt: Date): string => dueAt.toISOString().slice(0, 16);

const SECOND = 1000;

function reasonForState(state: MachineState): SkippedRun["reason"] | undefined {
	if (state === "paused") return "machine_paused";
	if (state === "stopped") return "machine_stopped";
	return undefined;
}

/**
 * What to do about one machine, now.
 *
 * Everything due between the last check and now is considered. The most recent is queued if it is
 * within its grace period; everything older is skipped, which is how a backlog can never build up.
 */
export function planMachine(machine: SchedulingMachine, now: Date): SchedulingPlan {
	const plan: SchedulingPlan = { queue: [], skip: [] };
	const grace = (machine.graceSeconds ?? DEFAULT_GRACE_SECONDS) * SECOND;

	const due: Date[] = [];
	let cursor = machine.lastCheckedAt.getTime();
	// A long outage can hide many occurrences. They are all read so each can be reported, but only the
	// most recent is ever queued.
	while (due.length < 500) {
		const next = nextOccurrence(machine.schedule, cursor);
		if (next > now.getTime()) break;
		due.push(new Date(next));
		cursor = next;
	}
	if (due.length === 0) return plan;

	const stateReason = reasonForState(machine.state);
	const latest = due[due.length - 1] as Date;

	for (const dueAt of due) {
		const lateBySeconds = Math.floor((now.getTime() - dueAt.getTime()) / SECOND);
		const occurrenceKey = occurrenceKeyFor(dueAt);
		const entry = { machineId: machine.machineId, occurrenceKey, dueAt, lateBySeconds };

		if (stateReason) {
			plan.skip.push({ ...entry, reason: stateReason });
			continue;
		}
		// Only a running machine gets this far. Draft and ready machines simply have nothing to do yet.
		if (machine.state !== "running") continue;
		if (dueAt !== latest) {
			plan.skip.push({ ...entry, reason: "missed_window" });
			continue;
		}
		if (now.getTime() - dueAt.getTime() > grace) {
			plan.skip.push({ ...entry, reason: "missed_window" });
			continue;
		}
		plan.queue.push(entry);
	}

	return plan;
}

/** The same decision for many machines, which is what the scheduler loop asks for each time it wakes. */
export function planRuns(machines: Iterable<SchedulingMachine>, now: Date): SchedulingPlan {
	const plan: SchedulingPlan = { queue: [], skip: [] };
	for (const machine of machines) {
		const one = planMachine(machine, now);
		plan.queue.push(...one.queue);
		plan.skip.push(...one.skip);
	}
	return plan;
}
