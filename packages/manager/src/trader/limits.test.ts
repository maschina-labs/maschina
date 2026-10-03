import { describe, expect, it } from "vitest";
import { buy, newBook } from "./book.ts";
import {
	checkBuy,
	checkSell,
	DEFAULT_LIMITS,
	drawdownHit,
	stopsHit,
	tradesInLastHour,
} from "./limits.ts";

const NOW = new Date("2026-10-03T12:00:00Z");
const fresh = newBook(40_000_000n);
const ask = (over: Partial<Parameters<typeof checkBuy>[1]> = {}) => ({
	mint: "A",
	usdc: 5_000_000n,
	impactPct: 0.5,
	now: NOW,
	worthNow: 40_000_000n,
	...over,
});
const holding = (book: typeof fresh, mint: string, at = NOW) =>
	buy(book, {
		at,
		mint,
		symbol: mint,
		decimals: 6,
		usdc: 1_000_000n,
		received: 1_000n,
		feeUsdc: 0n,
		reason: "",
	});

describe("the limits on a buy", () => {
	it("allows a buy inside every limit", () => {
		expect(checkBuy(fresh, ask(), DEFAULT_LIMITS)).toEqual({ allowed: true });
	});

	it.each([
		[{ usdc: 11_000_000n }, "$11.00 is over the $10.00 limit per trade"],
		[{ usdc: 0n }, "a buy must spend something"],
		[{ impactPct: 4.2 }, "would move the price 4.2%, over the 3% limit"],
		[{ impactPct: Number.NaN }, "would move the price NaN%"],
	])("refuses %o", (over, why) => {
		const verdict = checkBuy(fresh, ask(over), DEFAULT_LIMITS);
		expect(verdict.allowed).toBe(false);
		expect(!verdict.allowed && verdict.reason).toContain(why);
	});

	it("refuses spending cash it does not have", () => {
		const poor = newBook(2_000_000n);
		expect(checkBuy(poor, ask(), DEFAULT_LIMITS)).toMatchObject({
			allowed: false,
			reason: "only $2.00 of cash is left",
		});
	});

	it("refuses a new token past the most it may hold, but allows more of one it holds", () => {
		let book = fresh;
		for (const mint of ["A", "B", "C", "D", "E", "F"]) book = holding(book, mint);
		expect(checkBuy(book, ask({ mint: "G" }), DEFAULT_LIMITS)).toMatchObject({ allowed: false });
		expect(checkBuy(book, ask({ mint: "A" }), DEFAULT_LIMITS)).toEqual({ allowed: true });
	});

	it("refuses churning: no more than the hourly number of trades", () => {
		let book = newBook(1_000_000_000n);
		for (let i = 0; i < 60; i += 1) book = holding(book, "A");
		expect(tradesInLastHour(book, NOW)).toBe(60);
		expect(checkBuy(book, ask(), DEFAULT_LIMITS)).toMatchObject({ allowed: false });
		// An hour later they no longer count.
		expect(tradesInLastHour(book, new Date(NOW.getTime() + 3_600_001))).toBe(0);
	});

	it("pauses the trader once the book is down past the drawdown", () => {
		expect(drawdownHit(fresh, 28_000_000n, DEFAULT_LIMITS)).toBe(true);
		expect(drawdownHit(fresh, 28_000_001n, DEFAULT_LIMITS)).toBe(false);
		expect(drawdownHit(newBook(0n), 0n, DEFAULT_LIMITS)).toBe(false);
		expect(checkBuy(fresh, ask({ worthNow: 20_000_000n }), DEFAULT_LIMITS)).toMatchObject({
			allowed: false,
			pause: true,
		});
	});

	it("never stops a sale", () => {
		expect(checkSell()).toEqual({ allowed: true });
	});
});

describe("the stop on each holding", () => {
	it("names the holdings down past the stop, and leaves the rest", () => {
		const book = holding(holding(fresh, "A"), "B");
		const values: Record<string, bigint | undefined> = { A: 840_000n, B: 860_000n };
		const hit = stopsHit(book.holdings, (held) => values[held.mint], DEFAULT_LIMITS);
		expect(hit.map((each) => each.mint)).toEqual(["A"]);
	});

	it("does not sell on a missing price: that is not a loss, it is not knowing", () => {
		const book = holding(fresh, "A");
		expect(stopsHit(book.holdings, () => undefined, DEFAULT_LIMITS)).toEqual([]);
	});
});
