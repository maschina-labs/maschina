import { describe, expect, it } from "vitest";
import { Alert, AlertDelivered } from "./alerts.ts";

const sale = {
	eventId: "e",
	ownerId: "o",
	machineId: "m",
	machineName: "Range Finder",
	type: "trade.completed",
	occurredAt: "2026-09-29T02:00:00.000Z",
	trade: {
		inputMint: "So11111111111111111111111111111111111111112",
		outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		inputAmount: "339698787",
		outputAmount: "41360000",
	},
	realised: "-120000",
};

describe("an alert", () => {
	it("carries a trade and a realised result that may be a loss", () => {
		expect(Alert.parse(sale)).toEqual(sale);
	});

	it("refuses amounts that are not whole numbers", () => {
		expect(() => Alert.parse({ ...sale, trade: { ...sale.trade, inputAmount: "0.3" } })).toThrow();
	});

	it("is marked delivered on a channel Maschina knows", () => {
		expect(AlertDelivered.parse({ eventId: "e", channel: "telegram" }).channel).toBe("telegram");
		expect(() => AlertDelivered.parse({ eventId: "e", channel: "fax" })).toThrow();
	});
});
