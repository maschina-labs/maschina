import { describe, expect, it } from "vitest";
import { brandOf, modeOf, skyAt, themeFrom } from "./theme.ts";

describe("themes", () => {
	it("reads a saved theme, and falls back to dark for anything else", () => {
		expect(themeFrom("light")).toBe("light");
		expect(themeFrom("system")).toBe("system");
		expect(themeFrom("dynamic")).toBe("dynamic");
		expect(themeFrom(null)).toBe("dark");
		expect(themeFrom("purple")).toBe("dark");
	});

	it("dark and light are fixed; system follows the computer", () => {
		expect(modeOf("dark", { systemDark: false, hour: 12 })).toBe("dark");
		expect(modeOf("light", { systemDark: true, hour: 2 })).toBe("light");
		expect(modeOf("system", { systemDark: true, hour: 12 })).toBe("dark");
		expect(modeOf("system", { systemDark: false, hour: 2 })).toBe("light");
	});

	it("dynamic is light by day and dark by night", () => {
		expect(modeOf("dynamic", { systemDark: true, hour: 12 })).toBe("light");
		expect(modeOf("dynamic", { systemDark: false, hour: 2 })).toBe("dark");
		expect(modeOf("dynamic", { systemDark: false, hour: 22 })).toBe("dark");
	});

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

describe("tribute themes", () => {
	it("Club is now Helius, so a browser that chose it keeps its orange", () => {
		expect(themeFrom("club")).toBe("helius");
		expect(themeFrom("helius")).toBe("helius");
	});

	it("Frost is gone, and a browser that chose it falls back to dark", () => {
		expect(themeFrom("frost")).toBe("dark");
	});

	it("every one comes dark and light, each with its own sky and accent", () => {
		const ids = ["helius", "ore", "jupiter", "solana", "phantom", "backpack", "solflare", "bonk"];
		for (const id of ids) {
			for (const [theme, mode] of [
				[id, "dark"],
				[`${id}-light`, "light"],
			] as const) {
				expect(themeFrom(theme)).toBe(theme);
				const brand = brandOf(themeFrom(theme));
				expect(brand?.id).toBe(id);
				expect(brand?.mode).toBe(mode);
				expect(brand?.accent).toMatch(/^oklch\(/);
				expect(brand?.onAccent).toMatch(/^oklch\(/);
				// A light city is pale behind, a dark one dark, whatever the computer or the hour says.
				expect((brand?.sky.night.l ?? 0) > 0.6).toBe(mode === "light");
				expect(modeOf(themeFrom(theme), { systemDark: true, hour: 2 })).toBe(mode);
				expect(modeOf(themeFrom(theme), { systemDark: false, hour: 12 })).toBe(mode);
			}
		}
	});

	it("a made up team, light or not, falls back to dark", () => {
		expect(themeFrom("nobody-light")).toBe("dark");
		expect(themeFrom("light-light")).toBe("dark");
	});

	it("the plain themes have no accent of their own", () => {
		expect(brandOf("dark")).toBeUndefined();
		expect(brandOf("dynamic")).toBeUndefined();
	});
});
