import { describe, expect, it } from "vitest";
import { rgbaOf } from "./chart-tone.ts";

describe("a theme color for the charting library", () => {
	it("turns OKLCH into the rgba the library reads, exactly at the ends", () => {
		expect(rgbaOf("oklch(100% 0 0)")).toBe("rgba(255, 255, 255, 1)");
		expect(rgbaOf("oklch(0% 0 0)", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
	});

	it("lands on sRGB red for red's own OKLCH", () => {
		expect(rgbaOf("oklch(62.8% 0.2577 29.23)")).toBe("rgba(255, 0, 0, 1)");
	});

	it("reads nothing it does not understand", () => {
		expect(rgbaOf("purple")).toBeUndefined();
	});
});
