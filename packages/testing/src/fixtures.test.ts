import { describe, expect, it } from "vitest";
import { testClock, testId, units } from "./fixtures.ts";

describe("fixtures", () => {
	it("builds amounts, clocks and ids", () => {
		expect(units(5)).toBe(5n);
		expect(units(5n)).toBe(5n);
		expect(testClock().now().toISOString()).toBe("2026-09-16T12:00:00.000Z");
		expect(testId<"machine">()).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("refuses negative amounts", () => {
		expect(() => units(-1)).toThrow();
	});
});
