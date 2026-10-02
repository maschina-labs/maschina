import { describe, expect, it } from "vitest";
import { CLEAR, roundedPlace, weatherFrom, weatherOf } from "./weather.ts";

describe("weather from the forecast's codes", () => {
	it("clear and cloud", () => {
		expect(weatherOf(0)).toEqual(CLEAR);
		expect(weatherOf(2).cloud).toBeGreaterThan(0);
		expect(weatherOf(3).cloud).toBeGreaterThan(weatherOf(2).cloud);
		expect(weatherOf(3).rain).toBe("none");
	});

	it("fog thickens the city", () => {
		expect(weatherOf(45).fog).toBeGreaterThan(0.5);
		expect(weatherOf(48).fog).toBeGreaterThan(0.5);
	});

	it("drizzle, rain and heavy rain each run on the glass", () => {
		expect(weatherOf(51).rain).toBe("drizzle");
		expect(weatherOf(61).rain).toBe("rain");
		expect(weatherOf(65).rain).toBe("heavy");
		expect(weatherOf(82).rain).toBe("heavy");
		// Freezing rain is still rain on the window.
		expect(weatherOf(67).rain).toBe("heavy");
	});

	it("snow falls beyond the glass, light to heavy", () => {
		expect(weatherOf(71).snow).toBeGreaterThan(0);
		expect(weatherOf(75).snow).toBeGreaterThan(weatherOf(71).snow);
		expect(weatherOf(86).snow).toBeGreaterThan(weatherOf(85).snow);
		expect(weatherOf(73).rain).toBe("none");
	});

	it("thunderstorms bring lightning and heavy rain; hail comes with them", () => {
		expect(weatherOf(95).lightning).toBe(true);
		expect(weatherOf(95).rain).toBe("heavy");
		expect(weatherOf(99).hail).toBe(true);
		expect(weatherOf(61).lightning).toBe(false);
	});

	it("an unknown code is clear rather than wrong", () => {
		expect(weatherOf(1234)).toEqual(CLEAR);
	});

	it("reads the preview switch by name", () => {
		expect(weatherFrom("rain")?.rain).toBe("rain");
		expect(weatherFrom("snow")?.snow).toBeGreaterThan(0);
		expect(weatherFrom("storm")?.lightning).toBe(true);
		expect(weatherFrom("fog")?.fog).toBeGreaterThan(0);
		expect(weatherFrom("clear")).toEqual(CLEAR);
		expect(weatherFrom("nonsense")).toBeUndefined();
		expect(weatherFrom(null)).toBeUndefined();
	});

	it("rounds a location to about ten kilometres before it leaves the browser", () => {
		expect(roundedPlace(45.42153, -75.69719)).toEqual({ latitude: 45.4, longitude: -75.7 });
	});
});
