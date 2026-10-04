import { describe, expect, it } from "vitest";
import { percent } from "./pages.tsx";

describe("a change as a percent", () => {
	it("is exact while small, and compact once large, so it fits its tile", () => {
		expect(percent(0.1234)).toBe("+12.34%");
		expect(percent(-0.05)).toBe("-5.00%");
		expect(percent(12.34)).toBe("+1,234%");
		expect(percent(1_003_375.93)).toBe("+100.3M%");
	});
});
