import { describe, expect, it } from "vitest";
import { candleTime, tradesFrom } from "./trades.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

const trade = (
	tradeId: string,
	from: string,
	to: string,
	spent: string,
	got: string,
	at: string,
) => [
	{
		id: `${tradeId}i`,
		type: "trade.intended",
		occurredAt: at,
		payload: { tradeId, inputMint: from, outputMint: to },
	},
	{
		id: `${tradeId}c`,
		type: "trade.completed",
		occurredAt: at,
		payload: { tradeId, inputAmount: spent, outputAmount: got },
	},
];

describe("the trades a machine made", () => {
	it("reads the first real buy at the price it got", () => {
		const [buy] = tradesFrom(
			trade("t1", USDC, SOL, "40350000", "339698000", "2026-09-28T06:22:39Z"),
		);
		expect(buy?.side).toBe("buy");
		expect(buy?.price).toBeCloseTo(118.78, 2);
	});

	it("reads a record newest first, the way the API sends it", () => {
		const newestFirst = [
			...trade("t1", USDC, SOL, "40350000", "339698000", "2026-09-28T06:22:39Z"),
			...trade("t2", SOL, USDC, "339698000", "41170000", "2026-09-28T09:00:00Z"),
		].reverse();
		expect(tradesFrom(newestFirst).map((each) => each.side)).toEqual(["buy", "sell"]);
	});

	it("reads a sale the other way round", () => {
		const [sell] = tradesFrom(
			trade("t2", SOL, USDC, "339698000", "41170000", "2026-09-28T09:00:00Z"),
		);
		expect(sell?.side).toBe("sell");
		expect(sell?.price).toBeCloseTo(121.2, 1);
	});

	it("ignores a trade that never completed", () => {
		const [intended] = trade("t3", USDC, SOL, "1", "1", "2026-09-28T06:00:00Z");
		expect(tradesFrom([intended as never])).toEqual([]);
	});
});

describe("which candle a moment falls in", () => {
	it("is the start of its interval, shifted like the candles are", () => {
		const at = Date.parse("2026-09-28T06:22:39Z");
		expect(candleTime(at, "15m", 0)).toBe(Date.parse("2026-09-28T06:15:00Z") / 1000);
		expect(candleTime(at, "1h", 240)).toBe(Date.parse("2026-09-28T06:00:00Z") / 1000 - 240 * 60);
	});
});
