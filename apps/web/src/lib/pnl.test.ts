import { describe, expect, it } from "vitest";
import { portfolioPnl, realizedSteps, recent } from "./pnl.ts";

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

describe("realized profit over time", () => {
	it("counts nothing for a buy, and the difference once it sells", () => {
		const events = [
			...trade(USDC, SOL, "40350000", "339698000", 22),
			...trade(SOL, USDC, "339698000", "40980000", 50),
		];
		expect(realizedSteps(events)).toEqual([{ time: Date.parse(at(50)) / 1000, value: 630_000n }]);
	});

	it("reads a record newest first, the way the API sends it", () => {
		const events = [
			...trade(USDC, SOL, "40350000", "339698000", 22),
			...trade(SOL, USDC, "339698000", "40980000", 50),
		].reverse();
		expect(realizedSteps(events)).toEqual([{ time: Date.parse(at(50)) / 1000, value: 630_000n }]);
	});

	it("counts a loss as a loss", () => {
		const events = [
			...trade(USDC, SOL, "40000000", "340000000", 1),
			...trade(SOL, USDC, "340000000", "38000000", 2),
		];
		expect(realizedSteps(events).at(-1)?.value).toBe(-2_000_000n);
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
		expect(realizedSteps([...buy, ...sell, sell[1] as never]).length).toBe(1);
	});

	it("counts a sale bigger than the holding only against what was held", () => {
		const events = [
			...trade(USDC, SOL, "40000000", "300000000", 10),
			...trade(SOL, USDC, "600000000", "50000000", 20),
		];
		const last = realizedSteps(events).at(-1);
		expect(last?.value).toBe(10_000_000n);
	});

	it("ignores a completion it has already counted, or one with no intent behind it", () => {
		const events = [...trade(USDC, SOL, "40000000", "300000000", 10)];
		const repeated = { ...events[1], id: "again" } as (typeof events)[number];
		const orphan = {
			id: "orphan",
			type: "trade.completed",
			occurredAt: at(12),
			payload: { tradeId: "nobody", inputAmount: "1", outputAmount: "1" },
		};
		expect(realizedSteps([...events, repeated, orphan])).toEqual(realizedSteps(events));
	});
});

describe("recent profit, for a tile", () => {
	const day = 86_400;
	const now = 100 * day * 1000;
	const points = [
		{ time: 80 * day, value: 1_000_000n },
		{ time: 95 * day, value: 3_000_000n },
		{ time: 99 * day, value: 4_500_000n },
	];

	it("starts from where it stood a week ago, and says how far it moved since", () => {
		expect(recent(points, 7, now)).toEqual({ series: [1, 3, 4.5], change: 3.5 });
	});

	it("starts at zero when nothing came before the stretch", () => {
		expect(recent([{ time: 99 * day, value: 2_000_000n }], 7, now)).toEqual({
			series: [0, 2],
			change: 2,
		});
	});
});
