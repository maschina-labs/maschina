import { describe, expect, it } from "vitest";
import { DEFAULT_ROUND_TRIP_COST_BPS, edgeBps, meetsMinimumEdge } from "./edge.ts";

describe("how wide a band is", () => {
	it("is the distance between its edges, against the price it buys at", () => {
		// Buy at 120, sell at 130: a bit over eight percent.
		expect(edgeBps(120_000_000n, 130_000_000n)).toBe(833);
	});

	it("is nothing for a band with no width", () => {
		expect(edgeBps(120_000_000n, 120_000_000n)).toBe(0);
	});

	it("is nothing, not a negative, for a band the wrong way round", () => {
		// Upside down is refused elsewhere, on its own terms. Here it simply has no edge.
		expect(edgeBps(130_000_000n, 120_000_000n)).toBe(0);
	});

	it("rounds down, so a band is never credited with width it does not have", () => {
		expect(edgeBps(100_000_000n, 100_100_000n)).toBe(10);
		// A hair under eleven basis points is still ten, never eleven.
		expect(edgeBps(100_000_000n, 100_109_999n)).toBe(10);
	});
});

describe("whether a band can pay for itself", () => {
	it("accepts a band comfortably wider than the cost of trading it", () => {
		expect(meetsMinimumEdge({ buyLevel: 120_000_000n, sellLevel: 130_000_000n })).toEqual({
			ok: true,
			edgeBps: 833,
		});
	});

	it("refuses a band narrower than the round trip that works it", () => {
		// Two swaps, each paying a pool fee and slippage, plus what it costs to send them. A band inside
		// that loses money every time it works perfectly.
		const tight = meetsMinimumEdge({ buyLevel: 120_000_000n, sellLevel: 120_120_000n });

		expect(tight.ok).toBe(false);
		if (!tight.ok) expect(tight.problem).toMatch(/costs/);
	});

	it("refuses a band with no width at all", () => {
		expect(meetsMinimumEdge({ buyLevel: 120_000_000n, sellLevel: 120_000_000n }).ok).toBe(false);
	});

	it("takes an owner's own floor when they set one higher than the default", () => {
		const band = { buyLevel: 120_000_000n, sellLevel: 121_200_000n };

		expect(meetsMinimumEdge(band).ok).toBe(true);
		expect(meetsMinimumEdge({ ...band, minEdgeBps: 200 }).ok).toBe(false);
	});

	it("will not let an owner set a floor below what trading actually costs", () => {
		// The point of the rule is that it cannot be wished away. An owner who wants a tighter band is
		// asking to pay fees for nothing.
		const wished = meetsMinimumEdge({
			buyLevel: 120_000_000n,
			sellLevel: 120_120_000n,
			minEdgeBps: 1,
		});

		expect(wished.ok).toBe(false);
	});

	it("says what the cost floor is, so the number is not a secret", () => {
		expect(DEFAULT_ROUND_TRIP_COST_BPS).toBeGreaterThan(0);
	});
});
