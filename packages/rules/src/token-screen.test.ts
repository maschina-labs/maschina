import { describe, expect, it } from "vitest";
import { DEFAULT_SCREEN, screenToken, type TokenFacts } from "./token-screen.ts";

/** A token that passes everything: the shape every refusal below breaks one part of. */
const sound: TokenFacts = {
	mint: "Bonk111111111111111111111111111111111111111",
	mintAuthority: null,
	freezeAuthority: null,
	topHoldersShare: 0.18,
	holders: 12_000,
	liquidityUsd: 450_000,
	ageHours: 24 * 40,
	buyImpactPct: 0.4,
	sellImpactPct: 0.6,
	sellRoute: true,
};

describe("the token screen", () => {
	it("passes a token that is old enough, spread wide, liquid, and can be sold", () => {
		expect(screenToken(sound)).toEqual({ passed: true, reasons: [] });
	});

	it.each([
		[{ mintAuthority: "Owner111" }, "its supply can still be inflated: a mint authority is set"],
		[{ freezeAuthority: "Owner111" }, "holders can be frozen: a freeze authority is set"],
		[{ sellRoute: false }, "there is no route to sell it: it could be a honeypot"],
		[{ liquidityUsd: 9_000 }, "liquidity is $9,000, below the $25,000 minimum"],
		[{ topHoldersShare: 0.62 }, "the top holders own 62%, above the 35% limit"],
		[{ holders: 140 }, "only 140 holders, below the 500 minimum"],
		[{ ageHours: 3 }, "it is 3 hours old, younger than 24 hours"],
		[{ sellImpactPct: 7.5 }, "selling would move the price 7.5%, above the 3% limit"],
	] as const)("refuses %o, saying why", (change, why) => {
		const verdict = screenToken({ ...sound, ...change });
		expect(verdict.passed).toBe(false);
		expect(verdict.reasons).toContain(why);
	});

	it("names every reason at once, so one look says everything wrong with it", () => {
		const verdict = screenToken({ ...sound, mintAuthority: "x", freezeAuthority: "y", holders: 3 });
		expect(verdict.reasons).toHaveLength(3);
	});

	it("refuses what it cannot see: an unknown figure is never taken as a good one", () => {
		const verdict = screenToken({ ...sound, liquidityUsd: undefined, topHoldersShare: undefined });
		expect(verdict.passed).toBe(false);
		expect(verdict.reasons).toEqual(["its liquidity is unknown", "who holds it is unknown"]);
	});

	it("names every fact it could not read", () => {
		const blind = screenToken({
			mint: sound.mint,
			mintAuthority: undefined,
			freezeAuthority: undefined,
			topHoldersShare: undefined,
			holders: undefined,
			liquidityUsd: undefined,
			ageHours: undefined,
			buyImpactPct: undefined,
			sellImpactPct: 1,
			sellRoute: undefined,
		});
		expect(blind.reasons).toEqual([
			"whether more can be minted is unknown",
			"whether holders can be frozen is unknown",
			"whether it can be sold is unknown",
			"its liquidity is unknown",
			"who holds it is unknown",
			"how many hold it is unknown",
			"its age is unknown",
			"what a trade would cost in price impact is unknown",
		]);
	});

	it("says which side moves the price too far", () => {
		expect(screenToken({ ...sound, buyImpactPct: 6, sellImpactPct: 1 }).reasons).toEqual([
			"buying would move the price 6%, above the 3% limit",
		]);
	});

	it("takes stricter or looser limits when an owner sets them", () => {
		const strict = { ...DEFAULT_SCREEN, minLiquidityUsd: 1_000_000 };
		expect(screenToken(sound, strict).passed).toBe(false);
		const loose = { ...DEFAULT_SCREEN, minAgeHours: 1 };
		expect(screenToken({ ...sound, ageHours: 3 }, loose).passed).toBe(true);
	});
});
