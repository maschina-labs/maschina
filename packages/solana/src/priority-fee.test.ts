import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import {
	ABSOLUTE_MAX_PRIORITY_LAMPORTS,
	bidFor,
	checkFeeSettings,
	checkFeeWithinCap,
	DEFAULT_PRIORITY_FEE,
	lamportsForFee,
	microLamportsPerUnit,
	type PriorityFeeSettings,
	type RecentFee,
	suggestedMicroLamports,
} from "./priority-fee.ts";

const settings = (over: Partial<PriorityFeeSettings> = {}): PriorityFeeSettings => ({
	...DEFAULT_PRIORITY_FEE,
	...over,
});

const fees = (...microLamports: bigint[]): RecentFee[] =>
	microLamports.map((amount, index) => ({ slot: BigInt(index), microLamports: amount }));

describe("the cap on what a trade may bid", () => {
	it("accepts a normal setting", () => {
		expect(() => checkFeeSettings(settings())).not.toThrow();
	});

	it("refuses a cap of nothing, which could never be included when it matters", () => {
		expect(() => checkFeeSettings(settings({ maxLamports: 0n }))).toThrow(MaschinaError);
	});

	it("refuses a cap nobody should be able to type", () => {
		// A cap that only exists in a settings form is one typo away from not existing.
		expect(() =>
			checkFeeSettings(settings({ maxLamports: ABSOLUTE_MAX_PRIORITY_LAMPORTS + 1n })),
		).toThrow(/refused/);
	});

	it("allows exactly the absolute limit", () => {
		expect(() =>
			checkFeeSettings(settings({ maxLamports: ABSOLUTE_MAX_PRIORITY_LAMPORTS })),
		).not.toThrow();
	});
});

describe("the two ways of saying the same bid", () => {
	it("turns a cap in lamports into a rate per compute unit", () => {
		// 200,000 lamports over 1,400,000 compute units is about 142 micro-lamports each.
		expect(microLamportsPerUnit(200_000n, 1_400_000)).toBe(142_857n);
	});

	it("rounds the rate down, so a cap cannot be exceeded by rounding", () => {
		expect(microLamportsPerUnit(1n, 3)).toBe(333_333n);
		expect(lamportsForFee(333_333n, 3)).toBe(1n);
	});

	it("rounds the cost up, so nothing is ever under-counted", () => {
		expect(lamportsForFee(1n, 1)).toBe(1n);
		expect(lamportsForFee(1_000_000n, 1)).toBe(1n);
		expect(lamportsForFee(1_500_000n, 1)).toBe(2n);
	});

	it("refuses a compute limit that is not a whole number above zero", () => {
		expect(() => microLamportsPerUnit(1n, 0)).toThrow(MaschinaError);
		expect(() => lamportsForFee(1n, -1)).toThrow(MaschinaError);
		expect(() => lamportsForFee(1n, 1.5)).toThrow(MaschinaError);
	});
});

describe("what a router actually charged", () => {
	it("accepts a fee inside the cap", () => {
		expect(() => checkFeeWithinCap(199_999n, settings())).not.toThrow();
		expect(() => checkFeeWithinCap(200_000n, settings())).not.toThrow();
	});

	it("refuses a fee above the cap, because mostly respected is not respected", () => {
		expect(() => checkFeeWithinCap(200_001n, settings())).toThrow(/more priority fee than allowed/);
	});

	it("says nothing about a router that did not state a fee", () => {
		expect(() => checkFeeWithinCap(undefined, settings())).not.toThrow();
	});
});

describe("reading the going rate", () => {
	it("takes the middle of what was paid, not the most", () => {
		// One desperate transaction is not the price of inclusion.
		expect(suggestedMicroLamports(fees(1n, 2n, 3n, 4n, 1_000_000n))).toBe(3n);
	});

	it("is nothing when nobody has been paying, because there is nothing to outbid", () => {
		expect(suggestedMicroLamports([])).toBe(0n);
	});

	it("takes a percentile when asked for one", () => {
		const recent = fees(10n, 20n, 30n, 40n, 50n);

		expect(suggestedMicroLamports(recent, 0)).toBe(10n);
		expect(suggestedMicroLamports(recent, 100)).toBe(50n);
		expect(suggestedMicroLamports(recent, 50)).toBe(30n);
	});

	it("refuses a percentile that is not one", () => {
		expect(() => suggestedMicroLamports([], 101)).toThrow(MaschinaError);
		expect(() => suggestedMicroLamports([], -1)).toThrow(MaschinaError);
		expect(() => suggestedMicroLamports([], 1.5)).toThrow(MaschinaError);
	});
});

describe("deciding what to bid", () => {
	it("bids above the going rate, because matching it loses to everyone matching it", () => {
		const bid = bidFor(fees(100n, 100n, 100n), settings(), 1_000_000);

		expect(bid.microLamportsPerComputeUnit).toBe(200n);
		expect(bid.lamports).toBe(200n);
	});

	it("never bids past the cap, however busy the chain is", () => {
		const bid = bidFor(fees(10_000_000n), settings({ maxLamports: 5_000n }), 1_000_000);

		expect(bid.lamports).toBeLessThanOrEqual(5_000n);
		expect(bid.microLamportsPerComputeUnit).toBe(5_000n);
	});

	it("bids nothing when nobody is competing", () => {
		const bid = bidFor([], settings(), 1_000_000);

		expect(bid.microLamportsPerComputeUnit).toBe(0n);
		expect(bid.lamports).toBe(0n);
	});

	it("refuses to bid on a setting that should not exist", () => {
		expect(() => bidFor([], settings({ maxLamports: 0n }), 1_000_000)).toThrow(MaschinaError);
	});

	it("never costs more than the cap, whatever the numbers are", () => {
		for (const limit of [1, 200_000, 1_400_000]) {
			for (const going of [0n, 1n, 500n, 10_000_000n]) {
				const bid = bidFor(fees(going), settings({ maxLamports: 200_000n }), limit);

				expect(bid.lamports).toBeLessThanOrEqual(200_000n);
			}
		}
	});
});
