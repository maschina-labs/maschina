import { describe, expect, it } from "vitest";
import { BookError, buy, newBook, sell, worth } from "./book.ts";

const AT = new Date("2026-10-03T12:00:00Z");
const WIF = { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", decimals: 6 };

const bought = () =>
	buy(newBook(40_000_000n), {
		at: AT,
		...WIF,
		usdc: 10_000_000n,
		received: 5_000_000n,
		feeUsdc: 1_000n,
		reason: "momentum",
	});

describe("the trader's book", () => {
	it("starts with only cash", () => {
		expect(newBook(40_000_000n)).toEqual({
			startingCash: 40_000_000n,
			cash: 40_000_000n,
			holdings: [],
			fills: [],
			realized: 0n,
			fees: 0n,
		});
	});

	it("a buy takes cash and the network fee, and holds what the quote said", () => {
		const book = bought();
		expect(book.cash).toBe(29_999_000n);
		expect(book.fees).toBe(1_000n);
		expect(book.holdings).toEqual([
			{ ...WIF, amount: 5_000_000n, cost: 10_001_000n, openedAt: AT },
		]);
		expect(book.fills[0]).toMatchObject({
			side: "buy",
			usdc: 10_000_000n,
			amount: 5_000_000n,
			reason: "momentum",
		});
	});

	it("buying more of the same adds to one holding", () => {
		const book = buy(bought(), {
			at: AT,
			...WIF,
			usdc: 5_000_000n,
			received: 2_000_000n,
			feeUsdc: 1_000n,
			reason: "more",
		});
		expect(book.holdings).toHaveLength(1);
		expect(book.holdings[0]).toMatchObject({ amount: 7_000_000n, cost: 15_002_000n });
	});

	it("a sale realizes against what that part cost, fees counted", () => {
		const book = sell(bought(), {
			at: AT,
			mint: WIF.mint,
			amount: 2_500_000n,
			usdc: 6_000_000n,
			feeUsdc: 1_000n,
			reason: "took profit",
		});
		// Half the holding cost 5,000,500; it sold for 6,000,000 less a 1,000 fee.
		expect(book.realized).toBe(998_500n);
		expect(book.cash).toBe(29_999_000n + 5_999_000n);
		expect(book.holdings[0]).toMatchObject({ amount: 2_500_000n, cost: 5_000_500n });
		expect(book.fees).toBe(2_000n);
	});

	it("selling all of it closes the holding, and a loss is a loss", () => {
		const book = sell(bought(), {
			at: AT,
			mint: WIF.mint,
			amount: 5_000_000n,
			usdc: 8_000_000n,
			feeUsdc: 1_000n,
			reason: "stop",
		});
		expect(book.holdings).toEqual([]);
		expect(book.realized).toBe(-2_002_000n);
		expect(book.cash).toBe(37_998_000n);
	});

	it("refuses what cannot be true", () => {
		const empty = newBook(1_000_000n);
		expect(() =>
			buy(empty, { at: AT, ...WIF, usdc: 1_000_000n, received: 1n, feeUsdc: 1n, reason: "" }),
		).toThrow(BookError);
		expect(() =>
			buy(empty, { at: AT, ...WIF, usdc: 0n, received: 1n, feeUsdc: 0n, reason: "" }),
		).toThrow("spend and receive");
		expect(() =>
			sell(empty, { at: AT, mint: WIF.mint, amount: 1n, usdc: 1n, feeUsdc: 0n, reason: "" }),
		).toThrow("nothing of that token");
		expect(() =>
			sell(bought(), {
				at: AT,
				mint: WIF.mint,
				amount: 6_000_000n,
				usdc: 1n,
				feeUsdc: 0n,
				reason: "",
			}),
		).toThrow("can only sell up to");
		expect(() =>
			sell(bought(), { at: AT, mint: WIF.mint, amount: 0n, usdc: 1n, feeUsdc: 0n, reason: "" }),
		).toThrow();
	});

	it("is worth its cash plus what each holding would sell for, and nothing for one that cannot be priced", () => {
		const book = bought();
		expect(worth(book, () => 12_000_000n)).toBe(41_999_000n);
		expect(worth(book, () => undefined)).toBe(29_999_000n);
	});
});
