import { describe, expect, it } from "vitest";
import type { MachineSummary } from "./machines.ts";
import { suggestionsFor } from "./suggestions.ts";

const machine = (state: MachineSummary["state"], position = "0", basis = "0") =>
	({
		machineId: "m",
		name: "Range Finder",
		state,
		result: { position, basis },
	}) as unknown as MachineSummary;

describe("the manager's suggestions", () => {
	it("says a stopped machine should be emptied", () => {
		expect(suggestionsFor([machine("stopped")], 118)[0]?.title).toBe("IT IS STOPPED");
	});

	it("says when the price has left a band, but not while it is inside", () => {
		const band = { buy: 118.8, sell: 121.2 };
		expect(suggestionsFor([{ ...machine("running"), band }], 125)[0]?.title).toBe(
			"THE PRICE HAS LEFT ITS BAND",
		);
		expect(suggestionsFor([{ ...machine("running"), band }], 120)).toEqual([]);
	});

	it("says how far down a holding is, from what it paid", () => {
		// The first real buy: 40.35 USDC for 0.339698 SOL, about 118.78 a SOL.
		const [said] = suggestionsFor([machine("running", "339698000", "40350000")], 117.95);
		expect(said?.title).toBe("DOWN 0.7% ON WHAT IT HOLDS");
		expect(said?.detail).toContain("PAID 118.78");
	});

	it("stays quiet about a holding that is up", () => {
		expect(suggestionsFor([machine("running", "339698000", "40350000")], 121)).toEqual([]);
	});
});
