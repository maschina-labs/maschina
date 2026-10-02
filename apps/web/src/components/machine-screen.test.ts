import { describe, expect, it } from "vitest";
import { fundAmounts } from "./machine-screen.tsx";

describe("what funding sends", () => {
	it("dollars to trade with, in USDC's six decimals, and SOL for fees", () => {
		expect(fundAmounts("40", true)).toEqual({ usdc: "40000000", lamports: "12000000" });
	});

	it("SOL for fees can be left out", () => {
		expect(fundAmounts("12.5", false)).toEqual({ usdc: "12500000", lamports: "0" });
	});

	it("only fees, when no dollars are typed", () => {
		expect(fundAmounts("", true)).toEqual({ usdc: "0", lamports: "12000000" });
	});

	it("nothing at all is nothing to send", () => {
		expect(fundAmounts("", false)).toBeUndefined();
		expect(fundAmounts("0", false)).toBeUndefined();
		expect(fundAmounts("abc", false)).toBeUndefined();
		expect(fundAmounts("-5", false)).toBeUndefined();
	});
});
