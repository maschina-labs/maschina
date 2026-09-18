/**
 * A machine's state, worked out from its events.
 *
 * The state is never stored as a fact of its own. Storing it would mean two places could disagree
 * about whether a machine is running, and the one that is wrong would still be acted on. Reading it
 * from the record means the answer to "is this machine running, and why did it stop" always comes from
 * the same place, and can be re-derived at any time.
 *
 *   draft  ->  ready  ->  running  <->  paused
 *                            |            |
 *                            +-> stopped <+
 *
 * This function is total: any sequence of events produces a state, including sequences that could not
 * happen. An event that doesn't apply to the current state is ignored rather than throwing, because the
 * record is append only and a strange sequence must still be readable years later.
 */

import type { RecordedEvent } from "@maschina/contracts";

export const MACHINE_STATES = ["draft", "ready", "running", "paused", "stopped"] as const;

export type MachineState = (typeof MACHINE_STATES)[number];

export type MachineStatus = {
	state: MachineState;
	/** Why it is paused or stopped, when the event said. */
	reason?: string;
	/** How many events were taken into account, for showing "up to date as of". */
	events: number;
};

/** Events that can move a machine between states. Everything else is history, not lifecycle. */
type LifecycleEvent = Extract<
	RecordedEvent,
	{
		type:
			| "machine.created"
			| "machine.started"
			| "machine.paused"
			| "machine.resumed"
			| "machine.stopped"
			| "machine.limits_changed";
	}
>;

const isLifecycle = (event: RecordedEvent): event is LifecycleEvent =>
	event.type.startsWith("machine.");

/** A machine is ready once its owner has granted it a budget above zero. */
function grantsBudget(event: LifecycleEvent): boolean {
	if (event.type !== "machine.limits_changed") return false;
	const { limit, to } = event.payload;
	return limit === "budgetGranted" && /^\d+$/.test(to) && BigInt(to) > 0n;
}

export function machineState(events: Iterable<RecordedEvent>): MachineStatus {
	let state: MachineState = "draft";
	let reason: string | undefined;
	let seen = 0;

	for (const event of events) {
		seen += 1;
		if (!isLifecycle(event)) continue;
		// Stopped is final. A machine that has been stopped is never running again, whatever follows.
		if (state === "stopped") continue;

		switch (event.type) {
			case "machine.created":
				break;
			case "machine.limits_changed":
				if (state === "draft" && grantsBudget(event)) state = "ready";
				break;
			case "machine.started":
				if (state === "ready" || state === "paused") {
					state = "running";
					reason = undefined;
				}
				break;
			case "machine.resumed":
				if (state === "paused") {
					state = "running";
					reason = undefined;
				}
				break;
			case "machine.paused":
				if (state === "running") {
					state = "paused";
					reason = event.payload.detail ?? event.payload.reason;
				}
				break;
			case "machine.stopped":
				state = "stopped";
				reason = event.payload.reason ?? `stopped by the ${event.payload.by}`;
				break;
		}
	}

	return reason === undefined ? { state, events: seen } : { state, reason, events: seen };
}

/** True when the machine may act: the only state in which anything is allowed to happen. */
export const canAct = (status: MachineStatus): boolean => status.state === "running";
