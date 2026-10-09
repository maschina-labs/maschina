import { describe, expect, it } from "vitest";
import { coordinate } from "./coordinates.tsx";

describe("coordinates", () => {
	it("writes north, south, east and west", () => {
		expect(coordinate(43.6512, "lat")).toBe("43.651°N");
		expect(coordinate(-33.8688, "lat")).toBe("33.869°S");
		expect(coordinate(-79.3832, "lng")).toBe("79.383°W");
		expect(coordinate(151.2093, "lng")).toBe("151.209°E");
	});
});
