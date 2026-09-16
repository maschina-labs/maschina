import { describe, expect, it } from "vitest";
import { ManualClock, systemClock } from "./clock.ts";

describe("systemClock", () => {
	it("reads the current time", () => {
		const before = Date.now();
		const now = systemClock.now().getTime();
		expect(now).toBeGreaterThanOrEqual(before);
		expect(now).toBeLessThanOrEqual(Date.now());
	});
});

describe("ManualClock", () => {
	it("starts where it is told and moves only when advanced", () => {
		const clock = new ManualClock("2026-09-16T12:00:00.000Z");
		expect(clock.now().toISOString()).toBe("2026-09-16T12:00:00.000Z");
		clock.advance(60_000);
		expect(clock.now().toISOString()).toBe("2026-09-16T12:01:00.000Z");
		clock.set("2026-09-17T00:00:00.000Z");
		expect(clock.now().toISOString()).toBe("2026-09-17T00:00:00.000Z");
	});

	it("never moves backwards", () => {
		const clock = new ManualClock();
		expect(() => clock.advance(-1)).toThrow(RangeError);
		expect(() => clock.set("2025-01-01T00:00:00.000Z")).toThrow(RangeError);
	});

	it("hands out copies, so callers can't change its time", () => {
		const clock = new ManualClock();
		const first = clock.now();
		first.setUTCFullYear(2000);
		expect(clock.now().getUTCFullYear()).toBe(2026);
	});
});
