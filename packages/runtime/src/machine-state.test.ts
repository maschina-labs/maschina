import type { RecordedEvent } from "@maschina/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canAct, MACHINE_STATES, machineState } from "./machine-state.ts";

const MACHINE = "0199a0a0-0000-7000-8000-000000000001";
const OWNER = "0199a0a0-0000-7000-8000-000000000004";

const event = (type: string, payload: unknown = {}) =>
	({ machineId: MACHINE, type, payload }) as RecordedEvent;

const created = event("machine.created", {
	ownerId: OWNER,
	definitionVersionId: "a".repeat(64),
	walletAddress: "So11111111111111111111111111111111111111112",
});
const funded = event("machine.limits_changed", {
	limit: "budgetGranted",
	from: null,
	to: "25000000",
});
const started = event("machine.started", {});
const paused = event("machine.paused", {
	reason: "repeated_failures",
	detail: "three trades failed",
});
const resumed = event("machine.resumed", {});
const stopped = event("machine.stopped", { by: "owner" });

describe("machineState", () => {
	it("starts as a draft, with nothing recorded", () => {
		expect(machineState([])).toEqual({ state: "draft", events: 0 });
	});

	it("becomes ready once a budget is granted", () => {
		expect(machineState([created]).state).toBe("draft");
		expect(machineState([created, funded]).state).toBe("ready");
	});

	it("ignores a budget change that grants nothing", () => {
		const zero = event("machine.limits_changed", { limit: "budgetGranted", from: null, to: "0" });
		const other = event("machine.limits_changed", { limit: "maxPerTrade", from: null, to: "1000" });
		expect(machineState([created, zero, other]).state).toBe("draft");
	});

	it("runs, pauses with a reason, resumes, and stops", () => {
		expect(machineState([created, funded, started]).state).toBe("running");
		expect(machineState([created, funded, started, paused])).toMatchObject({
			state: "paused",
			reason: "three trades failed",
		});
		expect(machineState([created, funded, started, paused, resumed]).state).toBe("running");
		expect(machineState([created, funded, started, stopped])).toMatchObject({
			state: "stopped",
			reason: "stopped by the owner",
		});
	});

	it("can be started again after a pause, the same as resuming", () => {
		expect(machineState([created, funded, started, paused, started]).state).toBe("running");
	});

	it("falls back to the reason code when a pause has no detail", () => {
		const bare = event("machine.paused", { reason: "budget_exhausted" });
		expect(machineState([created, funded, started, bare]).reason).toBe("budget_exhausted");
	});

	it("uses the stop reason when there is one, and says who stopped it when there isn't", () => {
		const byOwner = event("machine.stopped", { by: "owner", reason: "done for the year" });
		const bySystem = event("machine.stopped", { by: "system" });
		expect(machineState([created, funded, started, byOwner]).reason).toBe("done for the year");
		expect(machineState([created, funded, started, bySystem]).reason).toBe("stopped by the system");
	});

	it("forgets the pause reason once it runs again", () => {
		expect(machineState([created, funded, started, paused, resumed]).reason).toBeUndefined();
	});

	it("ignores events that don't apply, rather than throwing", () => {
		expect(machineState([started, resumed, paused]).state).toBe("draft");
		expect(machineState([created, funded, paused]).state).toBe("ready");
	});

	it("counts everything it read, including events that aren't about the lifecycle", () => {
		const trade = event("trade.completed", {});
		expect(machineState([created, funded, trade, started]).events).toBe(4);
	});

	it("says a machine may only act while running", () => {
		expect(canAct(machineState([created, funded, started]))).toBe(true);
		for (const events of [[], [created], [created, funded], [created, funded, started, paused]]) {
			expect(canAct(machineState(events))).toBe(false);
		}
	});
});

/** Every lifecycle event, for generating sequences no sane system would produce. */
const anyLifecycleEvent = fc.constantFrom(created, funded, started, paused, resumed, stopped);

describe("machineState, for any sequence of events at all", () => {
	it("always gives one of the five states", () => {
		fc.assert(
			fc.property(fc.array(anyLifecycleEvent, { maxLength: 40 }), (events) => {
				expect(MACHINE_STATES).toContain(machineState(events).state);
			}),
			{ numRuns: 2000 },
		);
	});

	it("never acts again once stopped, whatever follows", () => {
		fc.assert(
			fc.property(fc.array(anyLifecycleEvent, { maxLength: 40 }), (after) => {
				const status = machineState([created, funded, started, stopped, ...after]);
				expect(status.state).toBe("stopped");
				expect(canAct(status)).toBe(false);
			}),
			{ numRuns: 2000 },
		);
	});

	it("never runs without having been funded and started", () => {
		fc.assert(
			fc.property(
				fc.array(fc.constantFrom(created, paused, resumed, funded), { maxLength: 40 }),
				(events) => {
					expect(machineState(events).state).not.toBe("running");
				},
			),
			{ numRuns: 2000 },
		);
	});

	it("gives the same answer however many times it is asked", () => {
		fc.assert(
			fc.property(fc.array(anyLifecycleEvent, { maxLength: 20 }), (events) => {
				expect(machineState(events)).toEqual(machineState(events));
			}),
			{ numRuns: 500 },
		);
	});

	it("only ever reaches paused through running", () => {
		fc.assert(
			fc.property(fc.array(anyLifecycleEvent, { maxLength: 30 }), (events) => {
				const states = events.map((_, index) => machineState(events.slice(0, index + 1)).state);
				// Only the moment it becomes paused matters: once paused it stays paused until something moves it.
				states.forEach((state, index) => {
					const before = index === 0 ? "draft" : states[index - 1];
					if (state === "paused" && before !== "paused") expect(before).toBe("running");
				});
			}),
			{ numRuns: 1000 },
		);
	});
});
