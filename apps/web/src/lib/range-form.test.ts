import { describe, expect, it } from "vitest";
import { bandOf, rangeReady, rangeRequest, sixDecimals } from "./range-form.ts";

const form = {
	name: "SOL range",
	kind: "range",
	buyAt: "120.25",
	sellAt: "122.25",
	perBuy: "20",
	float: "20",
};

describe("the band", () => {
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
			amountPerBuy: "20000000",
		});
		expect(request.limits).toMatchObject({ budgetGranted: "20000000", maxPerTrade: "20000000" });
	});
});

describe("when it can be sent", () => {
	it("is ready with a name, a band that pays and a buy within the float", () => {
		expect(rangeReady(form)).toBe(true);
	});

	it.each([
		["a band that loses money", { buyAt: "120", sellAt: "120.5" }],
		["a buy bigger than the float", { perBuy: "30" }],
		["no name", { name: " " }],
		["a float of nothing", { float: "0", perBuy: "0" }],
	])("is not ready with %s", (_what, change) => {
		expect(rangeReady({ ...form, ...change })).toBe(false);
	});
});
