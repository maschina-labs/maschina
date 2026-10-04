import { describe, expect, it } from "vitest";
import { brandOf, choiceFrom, choiceFromTheme, DEFAULT_CHOICE, resolve, skyAt } from "./theme.ts";

const noon = { systemDark: true, hour: 12 };
const night = { systemDark: false, hour: 2 };

describe("the four choices", () => {
	it("carry over every theme saved before them, so nobody's screen changes", () => {
		expect(choiceFromTheme("dark")).toEqual(DEFAULT_CHOICE);
		expect(choiceFromTheme("light")).toMatchObject({ palette: "maschina", mode: "light" });
		expect(choiceFromTheme("system")).toMatchObject({ mode: "system", dynamic: false });
		// The old Dynamic is System with a dynamic sky.
		expect(choiceFromTheme("dynamic")).toMatchObject({ mode: "system", dynamic: true });
		expect(choiceFromTheme("solana-light")).toMatchObject({ palette: "solana", mode: "light" });
		expect(choiceFromTheme("ore")).toMatchObject({ palette: "ore", mode: "dark" });
		expect(choiceFromTheme("club")).toMatchObject({ palette: "helius" });
		expect(choiceFromTheme("frost")).toEqual(DEFAULT_CHOICE);
		expect(choiceFromTheme("nobody-light")).toEqual(DEFAULT_CHOICE);
		expect(choiceFromTheme(null)).toEqual(DEFAULT_CHOICE);
	});

	it("read each saved choice on its own, so one bad value never costs the rest", () => {
		const saved = JSON.stringify({
			palette: "jupiter",
			mode: "purple",
			dynamic: true,
			field: "ribbon",
		});
		expect(choiceFrom(saved, null)).toEqual({
			palette: "jupiter",
			mode: "dark",
			dynamic: true,
			field: "ribbon",
		});
		expect(choiceFrom("not json", "light")).toMatchObject({ mode: "light" });
		expect(choiceFrom(null, "dynamic")).toMatchObject({ mode: "system", dynamic: true });
	});

	it("dark and light are fixed; system follows the computer, or the sun when the sky is dynamic", () => {
		expect(resolve({ ...DEFAULT_CHOICE, mode: "dark" }, night).mode).toBe("dark");
		expect(resolve({ ...DEFAULT_CHOICE, mode: "light" }, night).mode).toBe("light");
		expect(resolve({ ...DEFAULT_CHOICE, mode: "system" }, noon).mode).toBe("dark");
		expect(resolve({ ...DEFAULT_CHOICE, mode: "system" }, night).mode).toBe("light");
		const sun = { ...DEFAULT_CHOICE, mode: "system" as const, dynamic: true };
		expect(resolve(sun, noon).mode).toBe("light");
		expect(resolve(sun, night).mode).toBe("dark");
		// Only then does Maschina's own sky move through the day.
		expect(resolve(sun, noon).sky).toEqual(skyAt(12));
		expect(resolve({ ...DEFAULT_CHOICE, mode: "dark", dynamic: true }, noon).sky).toBeUndefined();
	});

	it("a dynamic sky brings the weather; a still one never does", () => {
		expect(resolve({ ...DEFAULT_CHOICE, dynamic: true }, noon).weather).toBe(true);
		expect(resolve(DEFAULT_CHOICE, noon).weather).toBe(false);
	});

	it("a team's palette gives its own sky and accent in whichever mode is chosen", () => {
		const solanaLight = resolve({ ...DEFAULT_CHOICE, palette: "solana", mode: "light" }, night);
		expect(solanaLight.brand?.id).toBe("solana");
		expect(solanaLight.brand?.accent).toMatch(/^oklch\(/);
		expect(solanaLight.sky?.night.l).toBeGreaterThan(0.6);
		expect(resolve({ ...DEFAULT_CHOICE, palette: "solana" }, night).sky?.night.l).toBeLessThan(0.6);
		expect(resolve(DEFAULT_CHOICE, night).brand).toBeUndefined();
	});

	it("every team comes dark and light", () => {
		for (const id of [
			"helius",
			"ore",
			"jupiter",
			"solana",
			"phantom",
			"backpack",
			"solflare",
			"bonk",
		] as const) {
			expect(brandOf(id, "dark")?.sky.night.l).toBeLessThan(0.6);
			expect(brandOf(id, "light")?.sky.night.l).toBeGreaterThan(0.6);
		}
	});
});

describe("the sky through the day", () => {
	it("the sky is darkest at night, brightest at noon, and warm at sunset", () => {
		const night = skyAt(2);
		const noon = skyAt(12.5);
		const sunset = skyAt(18.5);
		expect(night.night.l).toBeLessThan(0.25);
		expect(noon.night.l).toBeGreaterThan(0.85);
		// Golden hour: the glow is strongly colored and warm (orange sits near hue 55).
		expect(sunset.glow.c).toBeGreaterThan(0.1);
		expect(Math.abs(sunset.glow.h - 55)).toBeLessThan(15);
	});

	it("moves smoothly: a minute changes the sky only a little", () => {
		for (let hour = 0; hour < 24; hour += 0.25) {
			const now = skyAt(hour);
			const next = skyAt(hour + 1 / 60);
			expect(Math.abs(now.night.l - next.night.l)).toBeLessThan(0.01);
			expect(Math.abs(now.glow.l - next.glow.l)).toBeLessThan(0.01);
		}
	});

	it("wraps past midnight without a jump", () => {
		expect(skyAt(24).night.l).toBeCloseTo(skyAt(0).night.l, 5);
		expect(skyAt(23.99).night.l).toBeCloseTo(skyAt(0).night.l, 2);
	});
});
