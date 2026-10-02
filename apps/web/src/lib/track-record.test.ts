import { describe, expect, it } from "vitest";
import { executionBps, holdingReturn, largestDrop, recordCsv } from "./track-record.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const trade = (
	id: string,
	from: string,
	to: string,
	spent: string,
	quoted: string,
	got: string,
	at: string,
) => [
	{
		id: `${id}i`,
		type: "trade.intended",
		occurredAt: at,
		payload: { tradeId: id, inputMint: from, outputMint: to, quotedOutputAmount: quoted },
	},
	{
		id: `${id}c`,
		type: "trade.completed",
		occurredAt: at,
		payload: { tradeId: id, inputAmount: spent, outputAmount: got, signature: "2dEH" },
	},
];

describe("a track record", () => {
	it("measures execution against the quote", () => {
		// Quoted 340,000,000 and got 339,698,000: about 8.9 basis points short.
		const record = trade(
			"t",
			USDC,
			SOL,
			"40350000",
			"340000000",
			"339698000",
			"2026-09-28T06:22:39Z",
		);
		expect(executionBps(record)).toBeCloseTo(-8.88, 1);
		expect(executionBps([])).toBeUndefined();
	});

	it("finds the largest fall from a high in realized profit", () => {
		const record = [
			...trade("a", USDC, SOL, "10000000", "100", "100", "2026-09-28T01:00:00Z"),
			...trade("b", SOL, USDC, "100", "13000000", "13000000", "2026-09-28T02:00:00Z"),
			...trade("c", USDC, SOL, "13000000", "100", "100", "2026-09-28T03:00:00Z"),
			...trade("d", SOL, USDC, "100", "11000000", "11000000", "2026-09-28T04:00:00Z"),
		];
		expect(largestDrop(record)).toBe(2_000_000n);
	});

	it("compares with just holding from the first buy", () => {
		const record = trade(
			"t",
			USDC,
			SOL,
			"40350000",
			"340000000",
			"339698000",
			"2026-09-28T06:22:39Z",
		);
		expect(holdingReturn(record, 121.2)).toBeCloseTo(0.0204, 3);
		expect(holdingReturn([], 121.2)).toBeUndefined();
	});

	it("exports the record as CSV with the signature", () => {
		const csv = recordCsv(
			trade("t", USDC, SOL, "40350000", "340000000", "339698000", "2026-09-28T06:22:39Z"),
		).split("\n");
		expect(csv[0]).toBe("time,type,what,detail,signature");
		expect(csv[2]).toContain('"trade.completed"');
		expect(csv[2]).toContain('"2dEH"');
	});
});
