import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MaschinaError } from "./errors.ts";
import {
	addAmounts,
	applyBasisPoints,
	baseUnitsOf,
	formatAmount,
	parseAmount,
	subtractAmounts,
} from "./money.ts";

const amount = fc.bigInt({ min: 0n, max: 10n ** 30n }).map(baseUnitsOf);
const decimals = fc.integer({ min: 0, max: 18 });

describe("parseAmount", () => {
	it("parses whole and fractional amounts into base units", () => {
		expect(parseAmount("1", 9)).toBe(1_000_000_000n);
		expect(parseAmount("1.5", 9)).toBe(1_500_000_000n);
		expect(parseAmount("0.000000001", 9)).toBe(1n);
		expect(parseAmount("25", 6)).toBe(25_000_000n);
		expect(parseAmount("7", 0)).toBe(7n);
	});

	it("refuses more decimal places than the token has, rather than rounding", () => {
		expect(() => parseAmount("0.0000000001", 9)).toThrow(MaschinaError);
		expect(() => parseAmount("1.5", 0)).toThrow(/0 decimal places|allows 0/);
	});

	it.each(["", "-1", "1e9", "1,000", ".5", "5.", "abc", "0x10", " 1 2"])("refuses %j", (input) => {
		expect(() => parseAmount(input, 9)).toThrow(MaschinaError);
	});

	it("refuses impossible decimal counts", () => {
		expect(() => parseAmount("1", -1)).toThrow(MaschinaError);
		expect(() => parseAmount("1", 19)).toThrow(MaschinaError);
		expect(() => parseAmount("1", 1.5)).toThrow(MaschinaError);
	});

	it("round-trips with formatAmount for any amount", () => {
		fc.assert(
			fc.property(amount, decimals, (value, d) => {
				expect(parseAmount(formatAmount(value, d), d)).toBe(value);
			}),
		);
	});
});

describe("parseAmount input length", () => {
	it("refuses input longer than any real amount", () => {
		const longest = `${"9".repeat(60)}.${"9".repeat(18)}`;
		expect(parseAmount(longest, 18)).toBe(10n ** 78n - 1n);
		expect(() => parseAmount(`1${"0".repeat(80)}`, 0)).toThrow(/too long/);
		expect(() => parseAmount(` ${"1".repeat(100_000)} `, 0)).toThrow(/too long/);
	});
});

describe("formatAmount round trip", () => {
	it("formats any amount so it parses back to the same value", () => {
		fc.assert(
			fc.property(amount, decimals, (value, places) => {
				expect(parseAmount(formatAmount(value, places), places)).toBe(value);
			}),
		);
	});
});

describe("formatAmount", () => {
	it("trims trailing zeros and pads small amounts", () => {
		expect(formatAmount(baseUnitsOf(1_500_000_000n), 9)).toBe("1.5");
		expect(formatAmount(baseUnitsOf(1_000_000_000n), 9)).toBe("1");
		expect(formatAmount(baseUnitsOf(1n), 9)).toBe("0.000000001");
		expect(formatAmount(baseUnitsOf(0n), 6)).toBe("0");
		expect(formatAmount(baseUnitsOf(42n), 0)).toBe("42");
	});
});

describe("baseUnitsOf", () => {
	it("refuses negative amounts", () => {
		expect(() => baseUnitsOf(-1n)).toThrow(MaschinaError);
	});
});

describe("adding and subtracting", () => {
	it("subtracting what was added gives back the original", () => {
		fc.assert(
			fc.property(amount, amount, (a, b) => {
				expect(subtractAmounts(addAmounts(a, b), b)).toBe(a);
			}),
		);
	});

	it("never goes below zero", () => {
		fc.assert(
			fc.property(amount, amount, (a, b) => {
				if (b > a) expect(() => subtractAmounts(a, b)).toThrow(MaschinaError);
				else expect(subtractAmounts(a, b)).toBeGreaterThanOrEqual(0n);
			}),
		);
	});

	it("reports the failure with a stable code", () => {
		try {
			subtractAmounts(baseUnitsOf(1n), baseUnitsOf(2n));
			expect.unreachable();
		} catch (error) {
			expect((error as MaschinaError).code).toBe("insufficient_amount");
		}
	});
});

describe("applyBasisPoints", () => {
	it("applies common fee rates", () => {
		expect(applyBasisPoints(baseUnitsOf(1_000_000n), 50, "down")).toBe(5_000n);
		expect(applyBasisPoints(baseUnitsOf(1_000_000n), 100, "down")).toBe(10_000n);
		expect(applyBasisPoints(baseUnitsOf(1_000_000n), 10_000, "down")).toBe(1_000_000n);
		expect(applyBasisPoints(baseUnitsOf(1_000_000n), 0, "up")).toBe(0n);
	});

	it("rounds in the direction asked", () => {
		expect(applyBasisPoints(baseUnitsOf(199n), 50, "down")).toBe(0n);
		expect(applyBasisPoints(baseUnitsOf(199n), 50, "up")).toBe(1n);
		expect(applyBasisPoints(baseUnitsOf(200n), 50, "up")).toBe(1n);
	});

	it("rounding up and down differ by at most one unit, and never exceed the amount", () => {
		fc.assert(
			fc.property(amount, fc.integer({ min: 0, max: 10_000 }), (value, bps) => {
				const down = applyBasisPoints(value, bps, "down");
				const up = applyBasisPoints(value, bps, "up");
				expect(up - down).toBeLessThanOrEqual(1n);
				expect(up).toBeGreaterThanOrEqual(down);
				expect(up).toBeLessThanOrEqual(value);
				expect(down * 10_000n).toBeLessThanOrEqual(value * BigInt(bps));
				expect(up * 10_000n).toBeGreaterThanOrEqual(value * BigInt(bps));
			}),
		);
	});

	it.each([-1, 10_001, 0.5, Number.NaN])("refuses a rate of %s", (bps) => {
		expect(() => applyBasisPoints(baseUnitsOf(1n), bps, "down")).toThrow(MaschinaError);
	});
});
