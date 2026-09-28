import { describe, expect, it } from "vitest";
import { portfolioPnl, realisedSteps } from "./pnl.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
let n = 0;
const at = (minute: number) => `2026-09-28T06:${String(minute).padStart(2, "0")}:00Z`;
const trade = (from: string, to: string, spent: string, got: string, minute: number) => {
	const tradeId = `t${n++}`;
	return [
		{
			id: `${tradeId}i`,
			type: "trade.intended",
			occurredAt: at(minute),
			payload: { tradeId, inputMint: from, outputMint: to },
		},
		{
			id: `${tradeId}c`,
			type: "trade.completed",
			occurredAt: at(minute),
			payload: { tradeId, inputAmount: spent, outputAmount: got },
		},
	];
};

describe("realised profit over time", () => {
	it("counts nothing for a buy, and the difference once it sells", () => {
		const events = [
			...trade(USDC, SOL, "40350000", "339698000", 22),
			...trade(SOL, USDC, "339698000", "40980000", 50),
		];
		expect(realisedSteps(events)).toEqual([{ time: Date.parse(at(50)) / 1000, value: 630_000n }]);
	});

	it("reads a record newest first, the way the API sends it", () => {
		const events = [
			...trade(USDC, SOL, "40350000", "339698000", 22),
			...trade(SOL, USDC, "339698000", "40980000", 50),
		].reverse();
		expect(realisedSteps(events)).toEqual([{ time: Date.parse(at(50)) / 1000, value: 630_000n }]);
	});

	it("counts a loss as a loss", () => {
		const events = [
			...trade(USDC, SOL, "40000000", "340000000", 1),
			...trade(SOL, USDC, "340000000", "38000000", 2),
		];
		expect(realisedSteps(events).at(-1)?.value).toBe(-2_000_000n);
	});

	it("adds every machine into one running total, in time order", () => {
		const a = [
			...trade(USDC, SOL, "10000000", "100", 1),
			...trade(SOL, USDC, "100", "11000000", 5),
		];
		const b = [
			...trade(USDC, SOL, "10000000", "100", 2),
			...trade(SOL, USDC, "100", "10500000", 3),
		];
		expect(portfolioPnl([a, b]).map((point) => point.value)).toEqual([500_000n, 1_500_000n]);
	});

	it("counts a completed trade once, however often the record repeats it", () => {
		const buy = trade(USDC, SOL, "10000000", "100", 1);
		const sell = trade(SOL, USDC, "100", "11000000", 5);
		expect(realisedSteps([...buy, ...sell, sell[1] as never]).length).toBe(1);
	});
});
