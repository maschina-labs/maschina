import { describe, expect, it } from "vitest";
import {
	bandOf,
	FEE_HEADROOM,
	ROUND_TRIP_COST,
	rangeReady,
	rangeRequest,
	sixDecimals,
} from "./range-form.ts";

const form = {
	name: "SOL range",
	kind: "range",
	buyAt: "120.25",
	sellAt: "122.25",
	perBuy: "19.5",
	float: "20",
};

describe("the band", () => {
	it("uses the same floor the server refuses below: sixty basis points", () => {
		// packages/rules DEFAULT_ROUND_TRIP_COST_BPS. If one moves without the other, the form tells an
		// owner a band is fine and the server refuses it, or the reverse.
		expect(ROUND_TRIP_COST).toBe(60 / 10_000);
	});

	it("is the width between the edges as a share of the buy price", () => {
		const band = bandOf("120.25", "122.25");
		expect(band.width).toBeCloseTo(0.01663, 4);
		expect(band.covers).toBe(true);
		expect(band.keeps).toBeCloseTo(0.01063, 4);
	});

	it("does not cover its costs below six tenths of a percent", () => {
		const narrow = bandOf("120", "120.5");
		expect(narrow.covers).toBe(false);
		expect(narrow.keeps).toBeLessThan(0);
	});

	it("is nothing until both prices make sense", () => {
		expect(bandOf("", "122")).toEqual({ width: 0, covers: false, keeps: 0 });
		expect(bandOf("122", "120")).toEqual({ width: 0, covers: false, keeps: 0 });
		expect(bandOf("abc", "120")).toEqual({ width: 0, covers: false, keeps: 0 });
	});
});

describe("what the form sends", () => {
	it("prices and amounts in six decimal base units, exactly", () => {
		expect(sixDecimals("120.25")).toBe("120250000");
		expect(sixDecimals("0.000001")).toBe("1");
	});

	it("makes the float the grant, and caps a buy at what each buy spends", () => {
		const request = rangeRequest(form);
		expect(request.settings).toMatchObject({
			buyLevel: "120250000",
			sellLevel: "122250000",
			amountPerBuy: "19500000",
		});
		expect(request.limits).toMatchObject({ budgetGranted: "20000000", maxPerTrade: "19500000" });
	});
});

describe("when it can be sent", () => {
	it("is ready with a name, a band that pays and a buy within the float", () => {
		expect(rangeReady(form)).toBe(true);
	});

	it.each([
		["a band that loses money", { buyAt: "120", sellAt: "120.5" }],
		["a buy bigger than the float", { perBuy: "30" }],
		// The signer holds back its fee allowance on top of what a buy spends, so a buy of the whole
		// float never fits the budget and is refused every time the price reaches the bottom edge.
		["a buy of the whole float, which leaves nothing for the fee", { perBuy: "20", float: "20" }],
		["a buy that leaves less than the fee", { perBuy: "19.9", float: "20" }],
		["no name", { name: " " }],
		["a float of nothing", { float: "0", perBuy: "0" }],
	])("is not ready with %s", (_what, change) => {
		expect(rangeReady({ ...form, ...change })).toBe(false);
	});
});

describe("how much of the float a buy may spend", () => {
	it("keeps back more than the signer's fee allowance, as the budget counts it", () => {
		// services/signer SIGNER_FEE_ALLOWANCE_LAMPORTS defaults to 205,000, which the budget adds to a buy
		// as if it were base units of USDC: $0.205. Less headroom than that and the buy never fits.
		expect(FEE_HEADROOM).toBeGreaterThan(205_000 / 1_000_000);
	});

	it("leaves room for the fee the signer holds back", async () => {
		const { mostPerBuy } = await import("./range-form.ts");
		expect(mostPerBuy("20")).toBe("19.75");
		expect(mostPerBuy("15")).toBe("14.75");
		expect(mostPerBuy("")).toBe("");
	});
});

describe("what an owner types", () => {
	it("reads dollar signs, commas and spaces as the number they are", async () => {
		const { numberFrom } = await import("./range-form.ts");
		expect(numberFrom("$119.40")).toBe(119.4);
		expect(numberFrom(" 1,250.5 ")).toBe(1250.5);
		expect(numberFrom("28")).toBe(28);
	});

	it("reads anything else as not a number, rather than as zero", async () => {
		const { numberFrom } = await import("./range-form.ts");
		expect(numberFrom("abc")).toBeNaN();
		expect(numberFrom("")).toBeNaN();
		expect(numberFrom("1.2.3")).toBeNaN();
	});

	it("builds the band and the request from a price typed with a dollar sign", () => {
		const typed = { ...form, buyAt: "$120.25", sellAt: "$122.25" };
		expect(bandOf(typed.buyAt, typed.sellAt).covers).toBe(true);
		expect(rangeReady(typed)).toBe(true);
		expect(rangeRequest(typed).settings.buyLevel).toBe("120250000");
	});

	it("is not ready, and does not break, with something that is not a number", () => {
		expect(rangeReady({ ...form, float: "twenty" })).toBe(false);
		expect(rangeReady({ ...form, buyAt: "1.2.3" })).toBe(false);
	});
});
