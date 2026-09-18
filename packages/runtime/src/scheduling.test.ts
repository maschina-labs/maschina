import type { Schedule } from "@maschina/rules";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MachineState } from "./machine-state.ts";
import {
	DEFAULT_GRACE_SECONDS,
	occurrenceKeyFor,
	planMachine,
	planRuns,
	type SchedulingMachine,
} from "./scheduling.ts";

const MACHINE = "0199a0a0-0000-7000-8000-000000000001";
const daily: Schedule = { every: "day", hour: 9, minute: 0, timeZone: "America/Edmonton" };
const at = (iso: string) => new Date(iso);

const machine = (overrides: Partial<SchedulingMachine> = {}): SchedulingMachine => ({
	machineId: MACHINE,
	state: "running",
	schedule: daily,
	lastCheckedAt: at("2026-06-15T14:00:00Z"),
	...overrides,
});

// 09:00 in Edmonton in June is 15:00 UTC.
const NINE_AM = "2026-06-15T15:00:00Z";

describe("planMachine", () => {
	it("queues nothing when nothing is due yet", () => {
		const plan = planMachine(machine(), at("2026-06-15T14:30:00Z"));
		expect(plan).toEqual({ queue: [], skip: [] });
	});

	it("queues the run when it is due", () => {
		const plan = planMachine(machine(), at(NINE_AM));
		expect(plan.queue).toHaveLength(1);
		expect(plan.queue[0]).toMatchObject({
			machineId: MACHINE,
			occurrenceKey: "2026-06-15T15:00",
			lateBySeconds: 0,
		});
	});

	it("queues a late run inside its grace period, saying how late it is", () => {
		const plan = planMachine(machine(), at("2026-06-15T15:30:00Z"));
		expect(plan.queue).toHaveLength(1);
		expect(plan.queue[0]?.lateBySeconds).toBe(30 * 60);
		expect(plan.skip).toHaveLength(0);
	});

	it("skips a run that is past its grace period, with the reason", () => {
		const plan = planMachine(machine(), at("2026-06-15T17:30:00Z"));
		expect(plan.queue).toHaveLength(0);
		expect(plan.skip).toHaveLength(1);
		expect(plan.skip[0]).toMatchObject({ reason: "missed_window", lateBySeconds: 150 * 60 });
	});

	it("respects a machine's own grace period", () => {
		const patient = machine({ graceSeconds: 6 * 60 * 60 });
		expect(planMachine(patient, at("2026-06-15T17:30:00Z")).queue).toHaveLength(1);
		const impatient = machine({ graceSeconds: 60 });
		expect(planMachine(impatient, at("2026-06-15T15:05:00Z")).skip).toHaveLength(1);
	});

	it("never piles up: a week offline queues one run, not seven", () => {
		const plan = planMachine(
			machine({ lastCheckedAt: at("2026-06-08T14:00:00Z") }),
			at("2026-06-15T15:10:00Z"),
		);
		expect(plan.queue).toHaveLength(1);
		expect(plan.queue[0]?.occurrenceKey).toBe("2026-06-15T15:00");
		// The older ones are reported as missed, so the owner can see what happened.
		expect(plan.skip).toHaveLength(7);
		expect(plan.skip.every((run) => run.reason === "missed_window")).toBe(true);
	});

	it("queues nothing for a machine that isn't running", () => {
		for (const state of ["draft", "ready"] as const) {
			const plan = planMachine(machine({ state }), at(NINE_AM));
			expect(plan, state).toEqual({ queue: [], skip: [] });
		}
	});

	it("records why a paused or stopped machine didn't run", () => {
		for (const [state, reason] of [
			["paused", "machine_paused"],
			["stopped", "machine_stopped"],
		] as const) {
			const plan = planMachine(machine({ state }), at(NINE_AM));
			expect(plan.queue, state).toHaveLength(0);
			expect(plan.skip[0]?.reason, state).toBe(reason);
		}
	});

	it("uses the same key for the same moment, so a run is queued once", () => {
		const first = planMachine(machine(), at(NINE_AM));
		const again = planMachine(machine(), at("2026-06-15T15:20:00Z"));
		expect(first.queue[0]?.occurrenceKey).toBe(again.queue[0]?.occurrenceKey);
	});

	it("defaults the grace period to an hour", () => {
		expect(DEFAULT_GRACE_SECONDS).toBe(3600);
		const justInside = planMachine(machine(), at("2026-06-15T15:59:00Z"));
		const justOutside = planMachine(machine(), at("2026-06-15T16:01:00Z"));
		expect(justInside.queue).toHaveLength(1);
		expect(justOutside.queue).toHaveLength(0);
	});
});

describe("occurrenceKeyFor", () => {
	it("is the moment to the minute, in UTC", () => {
		expect(occurrenceKeyFor(at("2026-06-15T15:00:00.000Z"))).toBe("2026-06-15T15:00");
	});

	it("is the same for the same minute, whatever the seconds", () => {
		expect(occurrenceKeyFor(at("2026-06-15T15:00:59.999Z"))).toBe(
			occurrenceKeyFor(at("2026-06-15T15:00:00.000Z")),
		);
	});
});

describe("planRuns", () => {
	it("plans every machine, keeping them apart", () => {
		const other = "0199a0a0-0000-7000-8000-000000000002";
		const plan = planRuns(
			[machine(), machine({ machineId: other, state: "paused" })],
			at("2026-06-15T15:10:00Z"),
		);
		expect(plan.queue.map((run) => run.machineId)).toEqual([MACHINE]);
		expect(plan.skip.map((run) => run.machineId)).toEqual([other]);
	});

	it("plans nothing for no machines", () => {
		expect(planRuns([], new Date())).toEqual({ queue: [], skip: [] });
	});
});

const anyState = fc.constantFrom<MachineState>("draft", "ready", "running", "paused", "stopped");

describe("planMachine, whatever it is given", () => {
	const anyMachine = fc.record({
		machineId: fc.constant(MACHINE),
		state: anyState,
		schedule: fc.constant(daily),
		lastCheckedAt: fc
			.integer({ min: Date.parse("2026-06-01T00:00:00Z"), max: Date.parse("2026-06-20T00:00:00Z") })
			.map((ms) => new Date(ms)),
		graceSeconds: fc.integer({ min: 0, max: 24 * 60 * 60 }),
	});
	const anyNow = fc
		.integer({ min: Date.parse("2026-06-01T00:00:00Z"), max: Date.parse("2026-07-01T00:00:00Z") })
		.map((ms) => new Date(ms));

	it("never queues more than one run at a time", () => {
		fc.assert(
			fc.property(anyMachine, anyNow, (m, now) => {
				expect(planMachine(m, now).queue.length).toBeLessThanOrEqual(1);
			}),
			{ numRuns: 1000 },
		);
	});

	it("only ever queues for a running machine", () => {
		fc.assert(
			fc.property(anyMachine, anyNow, (m, now) => {
				const plan = planMachine(m, now);
				if (m.state !== "running") expect(plan.queue).toHaveLength(0);
			}),
			{ numRuns: 1000 },
		);
	});

	it("never queues a run that isn't due yet", () => {
		fc.assert(
			fc.property(anyMachine, anyNow, (m, now) => {
				for (const run of planMachine(m, now).queue) {
					expect(run.dueAt.getTime()).toBeLessThanOrEqual(now.getTime());
				}
			}),
			{ numRuns: 1000 },
		);
	});

	it("never queues a run later than its grace period allows", () => {
		fc.assert(
			fc.property(anyMachine, anyNow, (m, now) => {
				for (const run of planMachine(m, now).queue) {
					expect(run.lateBySeconds).toBeLessThanOrEqual(m.graceSeconds);
				}
			}),
			{ numRuns: 1000 },
		);
	});

	it("gives every planned run a different key, so nothing is queued twice", () => {
		fc.assert(
			fc.property(anyMachine, anyNow, (m, now) => {
				const plan = planMachine(m, now);
				const keys = [...plan.queue, ...plan.skip].map((run) => run.occurrenceKey);
				expect(new Set(keys).size).toBe(keys.length);
			}),
			{ numRuns: 1000 },
		);
	});
});
