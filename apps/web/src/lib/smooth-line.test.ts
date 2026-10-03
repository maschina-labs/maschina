import { describe, expect, it } from "vitest";
import { niceTicks, smoothPath } from "./smooth-line.ts";

const ys = (d: string) => [...d.matchAll(/[ ,]?(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));

describe("a smooth line", () => {
	it("starts at the first point and ends at the last", () => {
		const d = smoothPath([
			{ x: 0, y: 10 },
			{ x: 10, y: 20 },
			{ x: 20, y: 5 },
		]);
		expect(d.startsWith("M0,10")).toBe(true);
		expect(d.endsWith("20,5")).toBe(true);
		expect(d.match(/C/g)).toHaveLength(2);
	});

	it("never bulges past a point, so it never shows a number that did not happen", () => {
		const d = smoothPath([
			{ x: 0, y: 0 },
			{ x: 10, y: 100 },
			{ x: 20, y: 100 },
			{ x: 30, y: 0 },
		]);
		for (const y of ys(d)) {
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(100);
		}
	});

	it("handles nothing, one point, and two at the same moment", () => {
		expect(smoothPath([])).toBe("");
		expect(smoothPath([{ x: 3, y: 4 }])).toBe("M3,4");
		expect(
			smoothPath([
				{ x: 1, y: 1 },
				{ x: 1, y: 5 },
			]),
		).not.toContain("NaN");
	});
});

describe("axis numbers", () => {
	it("chooses round steps", () => {
		expect(niceTicks(-0.37, 0.63)).toEqual([-0.25, 0, 0.25, 0.5]);
		expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100]);
		expect(niceTicks(2, 2)).toEqual([2]);
	});
});
