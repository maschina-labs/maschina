import { describe, expect, it } from "vitest";
import { holdingOf } from "./machines.ts";

describe("what an account holds", () => {
	const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
	it("reads one token in whole units, and nothing as zero", () => {
		const holdings = {
			address: "a",
			lamports: "0",
			tokens: [{ mint: USDC, amount: "1010000", decimals: 6 }],
		};
		expect(holdingOf(holdings, USDC)).toBe(1.01);
		expect(holdingOf(holdings, "other")).toBe(0);
		expect(holdingOf(undefined, USDC)).toBe(0);
	});
});
