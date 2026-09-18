import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { nextOccurrence, occurrencesBetween, type Schedule, WEEKDAYS } from "./schedule.ts";

const EDMONTON = "America/Edmonton";
const at = (iso: string) => Date.parse(iso);

/** What a moment looks like on the wall clock in a zone, for readable assertions. */
const wall = (ms: number, timeZone: string) =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	})
		.format(new Date(ms))
		.replace(", ", " ");

describe("nextOccurrence, daily", () => {
	const daily: Schedule = { every: "day", hour: 9, minute: 0, timeZone: EDMONTON };

	it("is today's slot when it is still ahead", () => {
		expect(wall(nextOccurrence(daily, at("2026-06-15T06:00:00Z")), EDMONTON)).toBe(
			"2026-06-15 09:00",
		);
	});

	it("is tomorrow's slot when today's has passed", () => {
		expect(wall(nextOccurrence(daily, at("2026-06-15T20:00:00Z")), EDMONTON)).toBe(
			"2026-06-16 09:00",
		);
	});

	it("moves on when asked again with its own answer, so a slot never repeats", () => {
		const first = nextOccurrence(daily, at("2026-06-15T06:00:00Z"));
		const second = nextOccurrence(daily, first);
		expect(second).toBeGreaterThan(first);
		expect(wall(second, EDMONTON)).toBe("2026-06-16 09:00");
	});
});

describe("nextOccurrence, weekly", () => {
	const monday: Schedule = {
		every: "week",
		weekday: "monday",
		hour: 9,
		minute: 30,
		timeZone: EDMONTON,
	};

	it("finds the next Monday", () => {
		// 2026-06-17 is a Wednesday.
		expect(wall(nextOccurrence(monday, at("2026-06-17T12:00:00Z")), EDMONTON)).toBe(
			"2026-06-22 09:30",
		);
	});

	it("uses today when today is the day and the time is ahead", () => {
		expect(wall(nextOccurrence(monday, at("2026-06-22T06:00:00Z")), EDMONTON)).toBe(
			"2026-06-22 09:30",
		);
	});

	it("skips to next week when today is the day but the time has passed", () => {
		expect(wall(nextOccurrence(monday, at("2026-06-22T20:00:00Z")), EDMONTON)).toBe(
			"2026-06-29 09:30",
		);
	});
});

describe("nextOccurrence, monthly", () => {
	it("runs on the chosen day", () => {
		const schedule: Schedule = {
			every: "month",
			dayOfMonth: 15,
			hour: 8,
			minute: 0,
			timeZone: EDMONTON,
		};
		expect(wall(nextOccurrence(schedule, at("2026-06-20T00:00:00Z")), EDMONTON)).toBe(
			"2026-07-15 08:00",
		);
	});

	it("runs on the last day of a short month instead of skipping it", () => {
		const schedule: Schedule = {
			every: "month",
			dayOfMonth: 31,
			hour: 8,
			minute: 0,
			timeZone: EDMONTON,
		};
		// February 2027 has 28 days, so the 31st becomes the 28th, not March.
		expect(wall(nextOccurrence(schedule, at("2027-02-01T00:00:00Z")), EDMONTON)).toBe(
			"2027-02-28 08:00",
		);
	});

	it("handles a leap year", () => {
		const schedule: Schedule = {
			every: "month",
			dayOfMonth: 30,
			hour: 8,
			minute: 0,
			timeZone: EDMONTON,
		};
		expect(wall(nextOccurrence(schedule, at("2028-02-01T00:00:00Z")), EDMONTON)).toBe(
			"2028-02-29 08:00",
		);
	});
});

describe("nextOccurrence, when the clocks change", () => {
	// Edmonton springs forward on 2026-03-08: 02:00 becomes 03:00, so 02:30 never happens.
	it("still runs when the scheduled time was skipped by the clocks", () => {
		const schedule: Schedule = { every: "day", hour: 2, minute: 30, timeZone: EDMONTON };
		const run = nextOccurrence(schedule, at("2026-03-08T06:00:00Z"));
		expect(wall(run, EDMONTON)).toBe("2026-03-08 03:00");
	});

	// Edmonton falls back on 2026-11-01: 02:00 becomes 01:00, so 01:30 happens twice.
	it("runs once when the scheduled time happened twice", () => {
		const schedule: Schedule = { every: "day", hour: 1, minute: 30, timeZone: EDMONTON };
		const runs = occurrencesBetween(
			schedule,
			at("2026-11-01T00:00:00Z"),
			at("2026-11-02T00:00:00Z"),
		);
		expect(runs).toHaveLength(1);
		expect(wall(runs[0] as number, EDMONTON)).toBe("2026-11-01 01:30");
		// The first of the two, which is mountain daylight time, not standard time.
		expect(new Date(runs[0] as number).toISOString()).toBe("2026-11-01T07:30:00.000Z");
	});

	it("keeps the same wall-clock time either side of a change", () => {
		const schedule: Schedule = { every: "day", hour: 9, minute: 0, timeZone: EDMONTON };
		const before = nextOccurrence(schedule, at("2026-03-06T20:00:00Z"));
		const after = nextOccurrence(schedule, at("2026-03-09T20:00:00Z"));
		expect(wall(before, EDMONTON)).toBe("2026-03-07 09:00");
		expect(wall(after, EDMONTON)).toBe("2026-03-10 09:00");
		// The gap in real time is 23 hours across the change, not 24.
		const across = nextOccurrence(schedule, at("2026-03-07T16:00:00Z"));
		expect(across - before).toBe(23 * 60 * 60 * 1000);
	});

	it("works in a zone with a half-hour offset", () => {
		const schedule: Schedule = { every: "day", hour: 9, minute: 0, timeZone: "Asia/Kolkata" };
		const run = nextOccurrence(schedule, at("2026-06-15T00:00:00Z"));
		expect(new Date(run).toISOString()).toBe("2026-06-15T03:30:00.000Z");
	});

	it("works in a zone that changes clocks at a different time of year", () => {
		// Sydney springs forward on 2026-10-04. Their 9am that day is 2026-10-03 22:00 UTC.
		const schedule: Schedule = { every: "day", hour: 9, minute: 0, timeZone: "Australia/Sydney" };
		const run = nextOccurrence(schedule, at("2026-10-03T12:00:00Z"));
		expect(wall(run, "Australia/Sydney")).toBe("2026-10-04 09:00");
		expect(new Date(run).toISOString()).toBe("2026-10-03T22:00:00.000Z");
	});
});

describe("occurrencesBetween", () => {
	const daily: Schedule = { every: "day", hour: 9, minute: 0, timeZone: EDMONTON };

	it("lists every slot in a window, oldest first", () => {
		const runs = occurrencesBetween(daily, at("2026-06-15T00:00:00Z"), at("2026-06-18T00:00:00Z"));
		expect(runs.map((run) => wall(run, EDMONTON))).toEqual([
			"2026-06-15 09:00",
			"2026-06-16 09:00",
			"2026-06-17 09:00",
		]);
	});

	it("is empty when nothing was due", () => {
		expect(
			occurrencesBetween(daily, at("2026-06-15T16:00:00Z"), at("2026-06-15T20:00:00Z")),
		).toEqual([]);
	});

	it("gives exactly one run a day across a clock change", () => {
		const runs = occurrencesBetween(daily, at("2026-03-01T00:00:00Z"), at("2026-03-31T00:00:00Z"));
		expect(runs).toHaveLength(30);
	});
});

describe("nextOccurrence, refusing nonsense", () => {
	it("refuses an impossible time or day", () => {
		const base = { every: "day", timeZone: EDMONTON } as const;
		expect(() => nextOccurrence({ ...base, hour: 24, minute: 0 }, 0)).toThrow(/hour/);
		expect(() => nextOccurrence({ ...base, hour: 9, minute: 60 }, 0)).toThrow(/minute/);
		expect(() =>
			nextOccurrence({ every: "month", dayOfMonth: 0, hour: 9, minute: 0, timeZone: EDMONTON }, 0),
		).toThrow(/dayOfMonth/);
	});

	it("refuses a time zone that doesn't exist", () => {
		expect(() =>
			nextOccurrence({ every: "day", hour: 9, minute: 0, timeZone: "Mars/Olympus" }, 0),
		).toThrow(/time zone/);
	});
});

const zones = fc.constantFrom(
	"America/Edmonton",
	"America/New_York",
	"Europe/London",
	"Europe/Berlin",
	"Asia/Kolkata",
	"Asia/Tokyo",
	"Australia/Sydney",
	"Pacific/Auckland",
	"UTC",
);

const anySchedule = fc.oneof(
	fc.record({
		every: fc.constant("day" as const),
		hour: fc.integer({ min: 0, max: 23 }),
		minute: fc.integer({ min: 0, max: 59 }),
		timeZone: zones,
	}),
	fc.record({
		every: fc.constant("week" as const),
		weekday: fc.constantFrom(...WEEKDAYS),
		hour: fc.integer({ min: 0, max: 23 }),
		minute: fc.integer({ min: 0, max: 59 }),
		timeZone: zones,
	}),
	fc.record({
		every: fc.constant("month" as const),
		dayOfMonth: fc.integer({ min: 1, max: 31 }),
		hour: fc.integer({ min: 0, max: 23 }),
		minute: fc.integer({ min: 0, max: 59 }),
		timeZone: zones,
	}),
);

/** Moments spread over four years, so every clock change is covered. */
const anyMoment = fc.integer({
	min: Date.parse("2026-01-01T00:00:00Z"),
	max: Date.parse("2030-01-01T00:00:00Z"),
});

describe("nextOccurrence, for any schedule at any moment", () => {
	it("is always in the future", () => {
		fc.assert(
			fc.property(anySchedule, anyMoment, (schedule, now) => {
				expect(nextOccurrence(schedule, now)).toBeGreaterThan(now);
			}),
			{ numRuns: 1500 },
		);
	}, 60_000);

	it("never repeats a slot: asking again always moves forward", () => {
		fc.assert(
			fc.property(anySchedule, anyMoment, (schedule, now) => {
				const first = nextOccurrence(schedule, now);
				const second = nextOccurrence(schedule, first);
				expect(second).toBeGreaterThan(first);
			}),
			{ numRuns: 1500 },
		);
	}, 60_000);

	it("never skips: nothing is due between now and the answer", () => {
		fc.assert(
			fc.property(anySchedule, anyMoment, (schedule, now) => {
				const next = nextOccurrence(schedule, now);
				expect(occurrencesBetween(schedule, now, next - 1)).toEqual([]);
			}),
			{ numRuns: 1000 },
		);
	}, 60_000);

	it("lands on the wanted minute, or later the same day when the clocks skipped it", () => {
		fc.assert(
			fc.property(anySchedule, anyMoment, (schedule, now) => {
				const next = nextOccurrence(schedule, now);
				const [, time] = wall(next, schedule.timeZone).split(" ");
				const [hour, minute] = (time as string).split(":").map(Number);
				const wanted = schedule.hour * 60 + schedule.minute;
				const got = (hour as number) * 60 + (minute as number);
				// Equal normally; later only when that local time did not exist.
				expect(got).toBeGreaterThanOrEqual(wanted);
				expect(got - wanted).toBeLessThanOrEqual(180);
			}),
			{ numRuns: 1500 },
		);
	}, 60_000);

	it("runs a daily schedule once a day, a day being 23 to 25 hours across clock changes", () => {
		fc.assert(
			fc.property(
				fc.record({
					hour: fc.integer({ min: 0, max: 23 }),
					minute: fc.integer({ min: 0, max: 59 }),
					timeZone: zones,
				}),
				(parts) => {
					const schedule = { every: "day" as const, ...parts };
					// A month containing clock changes in several of these zones.
					const runs = occurrencesBetween(
						schedule,
						Date.parse("2026-03-01T12:00:00Z"),
						Date.parse("2026-03-29T12:00:00Z"),
					);
					expect(runs.length).toBeGreaterThanOrEqual(27);
					expect(runs.length).toBeLessThanOrEqual(29);
					runs.slice(1).forEach((run, index) => {
						const gapHours = (run - (runs[index] as number)) / 3_600_000;
						expect(gapHours).toBeGreaterThanOrEqual(23);
						expect(gapHours).toBeLessThanOrEqual(25);
					});
				},
			),
			{ numRuns: 200 },
		);
	}, 60_000);
});
