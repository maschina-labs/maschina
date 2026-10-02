import { describe, expect, it } from "vitest";
import { launchFrom, takeOrigin, tileTransform } from "./launch.ts";

describe("launching a screen from a tile", () => {
	it("remembers the tile once, for the screen that opens", () => {
		launchFrom({ left: 10, top: 20, width: 100, height: 50 });
		expect(takeOrigin()).toEqual({ left: 10, top: 20, width: 100, height: 50 });
		expect(takeOrigin()).toBeUndefined();
	});

	it("starts the screen exactly over the tile", () => {
		const transform = tileTransform(
			{ left: 0, top: 0, width: 200, height: 100 },
			{ width: 1000, height: 500 },
		);
		expect(transform).toBe("translate3d(-400px, -200px, 0) scale(0.2, 0.2)");
	});

	it("settles in from the centre when there is no tile", () => {
		expect(tileTransform(undefined, { width: 1000, height: 500 })).toContain("scale(0.97)");
	});
});
