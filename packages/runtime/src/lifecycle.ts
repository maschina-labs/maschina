/**
 * What a machine may do next.
 *
 * `machineState` reads history and is deliberately forgiving: a strange sequence in the record still
 * produces an answer. This is the other half, and it is strict. Before anything is recorded, the asked
 * for change is checked here, so the record only ever gains changes that were allowed at the time.
 *
 *   draft  ->  ready  ->  running  <->  paused
 *                            |            |
 *                            +-> stopped <+
 *
 * Stopped is final. There is no way back, on purpose: an owner who stops a machine has decided, and a
 * machine that could quietly restart itself would be a machine you can't switch off.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import type { MachineState } from "./machine-state.ts";

export const MACHINE_ACTIONS = ["fund", "start", "pause", "resume", "stop"] as const;

export type MachineAction = (typeof MACHINE_ACTIONS)[number];

/** Every allowed move. Anything not listed here is refused. */
const ALLOWED: Record<MachineState, Partial<Record<MachineAction, MachineState>>> = {
	draft: { fund: "ready" },
	// Funding again is allowed and changes nothing about the state: the owner may top it up.
	ready: { fund: "ready", start: "running", stop: "stopped" },
	running: { fund: "running", pause: "paused", stop: "stopped" },
	// Start and resume mean the same thing to a paused machine, since owners say both.
	paused: { fund: "paused", start: "running", resume: "running", stop: "stopped" },
	stopped: {},
};

export type Transition = { from: MachineState; action: MachineAction; to: MachineState };

/** Every move a machine in this state may make. */
export const allowedActions = (state: MachineState): MachineAction[] =>
	Object.keys(ALLOWED[state]) as MachineAction[];

/** The state after an allowed action, or why it was refused. */
export function transition(
	state: MachineState,
	action: MachineAction,
): Result<Transition, MaschinaError> {
	const to = ALLOWED[state][action];
	if (!to) {
		const allowed = allowedActions(state);
		return err(
			new MaschinaError(
				"conflict",
				state === "stopped"
					? "a stopped machine is finished, and cannot be started again"
					: `a ${state} machine cannot ${action}`,
				{ details: { state, action, allowed } },
			),
		);
	}
	return ok({ from: state, action, to });
}

/** True when the action would be allowed, for deciding what to show an owner. */
export const can = (state: MachineState, action: MachineAction): boolean =>
	ALLOWED[state][action] !== undefined;
