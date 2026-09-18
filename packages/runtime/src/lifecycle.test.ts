import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	allowedActions,
	can,
	MACHINE_ACTIONS,
	type MachineAction,
	transition,
} from "./lifecycle.ts";
import { MACHINE_STATES, type MachineState } from "./machine-state.ts";

/** Every allowed move, written out, so the table in the code is checked against a second list. */
const allowed: Transitionish[] = [
	["draft", "fund", "ready"],
	["ready", "fund", "ready"],
	["ready", "start", "running"],
	["ready", "stop", "stopped"],
	["running", "fund", "running"],
	["running", "pause", "paused"],
	["running", "stop", "stopped"],
	["paused", "fund", "paused"],
	["paused", "start", "running"],
	["paused", "resume", "running"],
	["paused", "stop", "stopped"],
];
type Transitionish = [MachineState, MachineAction, MachineState];

describe("transition", () => {
	it.each(allowed)("allows a %s machine to %s, becoming %s", (from, action, to) => {
		const result = transition(from, action);
		expect(result.ok && result.value).toEqual({ from, action, to });
	});

	it("refuses everything else, saying what is allowed instead", () => {
		const isAllowed = new Set(allowed.map(([from, action]) => `${from}:${action}`));
		for (const state of MACHINE_STATES) {
			for (const action of MACHINE_ACTIONS) {
				if (isAllowed.has(`${state}:${action}`)) continue;
				const result = transition(state, action);
				expect(result.ok, `${state} ${action}`).toBe(false);
				if (!result.ok) {
					expect(result.error.code).toBe("conflict");
					expect(result.error.details?.["allowed"]).toEqual(allowedActions(state));
				}
			}
		}
	});

	it("says plainly that a stopped machine is finished", () => {
		const result = transition("stopped", "start");
		expect(!result.ok && result.error.message).toMatch(/finished, and cannot be started again/);
	});

	it("never lets a stopped machine do anything", () => {
		expect(allowedActions("stopped")).toEqual([]);
		for (const action of MACHINE_ACTIONS) expect(can("stopped", action)).toBe(false);
	});

	it("needs funding before a machine can start", () => {
		expect(can("draft", "start")).toBe(false);
		expect(can("ready", "start")).toBe(true);
	});

	it("lets an owner stop a machine from any state except draft", () => {
		expect(can("draft", "stop")).toBe(false);
		for (const state of ["ready", "running", "paused"] as const) {
			expect(can(state, "stop"), state).toBe(true);
		}
	});
});

describe("transition, for any state and action", () => {
	const anyState = fc.constantFrom(...MACHINE_STATES);
	const anyAction = fc.constantFrom(...MACHINE_ACTIONS);

	it("either gives a known state or refuses, and never throws", () => {
		fc.assert(
			fc.property(anyState, anyAction, (state, action) => {
				const result = transition(state, action);
				if (result.ok) expect(MACHINE_STATES).toContain(result.value.to);
				else expect(result.error.code).toBe("conflict");
			}),
			{ numRuns: 500 },
		);
	});

	it("agrees with itself: can() matches what transition() does", () => {
		fc.assert(
			fc.property(anyState, anyAction, (state, action) => {
				expect(can(state, action)).toBe(transition(state, action).ok);
			}),
			{ numRuns: 500 },
		);
	});

	it("never reaches a state outside the lifecycle, however many moves are made", () => {
		fc.assert(
			fc.property(fc.array(anyAction, { maxLength: 30 }), (actions) => {
				let state: MachineState = "draft";
				for (const action of actions) {
					const result = transition(state, action);
					if (result.ok) state = result.value.to;
				}
				expect(MACHINE_STATES).toContain(state);
			}),
			{ numRuns: 1000 },
		);
	});

	it("once stopped, stays stopped no matter what is asked", () => {
		fc.assert(
			fc.property(fc.array(anyAction, { maxLength: 30 }), (actions) => {
				let state: MachineState = "stopped";
				for (const action of actions) {
					const result = transition(state, action);
					if (result.ok) state = result.value.to;
				}
				expect(state).toBe("stopped");
			}),
			{ numRuns: 1000 },
		);
	});
});
