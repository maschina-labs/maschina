import { followingRange } from "@maschina/runtime";
import { describe, expect, it } from "vitest";
import { finderReady, finderRequest } from "./finder-form.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const form = { name: "Range Finder", float: "40.60", bandPct: 2.5, floorPct: 8 as const };

describe("the Range Finder the form makes", () => {
	it("sends the band and floor in basis points, and each buy as the float less the fee's room", () => {
		expect(finderRequest(form)).toEqual({
			name: "Range Finder",
			kind: followingRange.kind,
			settings: {
				quoteMint: USDC,
				baseMint: SOL,
				bandBps: 250,
				floorBps: 800,
				amountPerBuy: "40350000",
				slippageBps: 50,
			},
			limits: {
				budgetGranted: "40600000",
				maxPerTrade: "40350000",
				maxPerDay: "40600000",
				approvedMints: [USDC, SOL],
			},
		});
	});

	it("is a recipe the Range Finder itself accepts", () => {
		expect(followingRange.readSettings(finderRequest(form).settings).ok).toBe(true);
	});

	it("rounds a band typed to a tenth into whole basis points", () => {
		expect(finderRequest({ ...form, bandPct: 1.3 }).settings.bandBps).toBe(130);
	});
});

describe("when it can be sent", () => {
	it("needs a name and a float with room for a buy", () => {
		expect(finderReady(form)).toBe(true);
		expect(finderReady({ ...form, name: " " })).toBe(false);
		expect(finderReady({ ...form, float: "0.20" })).toBe(false);
		expect(finderReady({ ...form, float: "lots" })).toBe(false);
	});
});
