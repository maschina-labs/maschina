import { describe, expect, it } from "vitest";
import { INK_KEYS, inkFor } from "./ink.ts";

const parts = (color: string) => {
	const found = /oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/.exec(color);
	return found ? { l: Number(found[1]), c: Number(found[2]), h: Number(found[3]) } : undefined;
};

describe("a team's ink", () => {
	it("gives every step of the text scale the team's hue", () => {
		const ink = inkFor(292, "dark");
		expect(Object.keys(ink).sort()).toEqual([...INK_KEYS].sort());
		for (const key of INK_KEYS) {
			const color = parts(ink[key] ?? "");
			expect(color?.h).toBe(292);
			expect(color?.c).toBeGreaterThan(0);
		}
	});

	it("keeps titles nearly white and lets the quieter text carry more of the color", () => {
		const ink = inkFor(25, "dark");
		const title = parts(ink["--color-neutral-100"] ?? "");
		const quiet = parts(ink["--color-neutral-500"] ?? "");
		expect(title?.l).toBeGreaterThan(90);
		expect(title?.c).toBeLessThan(0.03);
		expect(quiet?.c).toBeGreaterThan(title?.c ?? 1);
	});

	it("turns over for light mode, the way the plain scale does: titles nearly black", () => {
		const ink = inkFor(25, "light");
		expect(parts(ink["--color-neutral-100"] ?? "")?.l).toBeLessThan(30);
		expect(parts(ink["--color-neutral-900"] ?? "")?.l).toBeGreaterThan(90);
	});
});
