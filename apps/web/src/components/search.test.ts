import { describe, expect, it } from "vitest";
import { matches } from "./search.tsx";

describe("search", () => {
	it("matches every word typed, in any order, against the label and the detail", () => {
		const machine = { label: "Range Finder", detail: "running" };
		expect(matches(machine, "range")).toBe(true);
		expect(matches(machine, "running finder")).toBe(true);
		expect(matches(machine, "paused")).toBe(false);
		expect(matches(machine, "")).toBe(true);
	});
});
