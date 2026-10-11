import { describe, expect, it } from "vitest";
import { limitReady, limitRequest } from "./trigger-form.ts";

describe("a limit order made into a machine", () => {
	it("buys SOL once the price falls to the level, with room in the budget for the fee", () => {
		const request = limitRequest({ level: "115.40", spend: "40", paper: true });

		expect(request.paper).toBe(true);
		expect(request.name).toBe("Buy SOL at 115.40");
		expect(request.settings).toMatchObject({
			level: "115400000",
			direction: "falls_to",
			amountPerTrade: "40000000",
		});
		expect(request.limits).toMatchObject({ budgetGranted: "40250000", maxPerTrade: "40000000" });
	});

	it("is only ready with a level and an amount", () => {
		expect(limitReady({ level: "115", spend: "40", paper: true })).toBe(true);
		expect(limitReady({ level: "", spend: "40", paper: true })).toBe(false);
		expect(limitReady({ level: "115", spend: "zero", paper: true })).toBe(false);
	});
});
