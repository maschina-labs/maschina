import { describe, expect, it } from "vitest";
import type { Holding } from "./book.ts";
import { exitFor, planFrom, withPeak } from "./exits.ts";

const held: Holding = {
	mint: "W",
	symbol: "WIF",
	decimals: 6,
	amount: 1n,
	cost: 10_000_000n,
	openedAt: new Date(),
};
const at = (dollars: number) => BigInt(Math.round(dollars * 1_000_000));

describe("an exit plan", () => {
	it("takes profit once up far enough", () => {
		expect(exitFor(held, at(10.5), { takeProfitPct: 4 }, 15)).toMatchObject({ kind: "sell" });
		expect(exitFor(held, at(10.3), { takeProfitPct: 4 }, 15)).toBeUndefined();
	});

	it("stops at the plan's stop when tighter than the owner's, never looser", () => {
		expect(exitFor(held, at(9.6), { stopPct: 3 }, 15)).toMatchObject({
			kind: "stop",
			reason: "down 3% or more from what it cost",
		});
		expect(exitFor(held, at(8.4), { stopPct: 40 }, 15)).toMatchObject({
			kind: "stop",
			reason: "down 15% or more from what it cost",
		});
		expect(exitFor(held, at(8.4), undefined, 15)).toMatchObject({ kind: "stop" });
	});

	it("trails from the best once armed, and not before", () => {
		expect(exitFor(held, at(10.2), { trailPct: 5, peak: String(at(10.3)) }, 15)).toBeUndefined();
		const fell = exitFor(held, at(10.9), { trailPct: 5, peak: String(at(11.6)) }, 15);
		expect(fell?.reason).toMatch(/^fell 6\.0% from its best, past the 5% trail, at \+9\.0%$/);
	});

	it("does nothing without a price", () => {
		expect(exitFor(held, undefined, { takeProfitPct: 1 }, 15)).toBeUndefined();
		expect(exitFor({ ...held, cost: 0n }, at(1), { takeProfitPct: 1 }, 15)).toBeUndefined();
	});

	it("keeps the best value seen", () => {
		expect(withPeak({ trailPct: 5 }, 10n)).toEqual({ trailPct: 5, peak: "10" });
		expect(withPeak({ trailPct: 5, peak: "12" }, 10n)).toEqual({ trailPct: 5, peak: "12" });
		expect(withPeak({ trailPct: 5, peak: "12" }, 14n)).toEqual({ trailPct: 5, peak: "14" });
		expect(withPeak(undefined, 10n)).toBeUndefined();
		expect(withPeak({}, undefined)).toEqual({});
	});

	it("takes only sensible numbers from the AI", () => {
		expect(planFrom({ takeProfitPct: 5, stopPct: "x", trailPct: -2 })).toEqual({
			takeProfitPct: 5,
		});
		expect(planFrom({ takeProfitPct: 4, stopPct: 3, trailPct: 2 })).toEqual({
			takeProfitPct: 4,
			stopPct: 3,
			trailPct: 2,
		});
	});
});
