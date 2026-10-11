import { describe, expect, it } from "vitest";
import { standings } from "./leaderboard.ts";
import type { MachineSummary } from "./machines.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const trade = (id: string, from: string, to: string, spent: string, got: string, at: string) => [
	{
		id: `${id}i`,
		type: "trade.intended",
		occurredAt: at,
		payload: { tradeId: id, inputMint: from, outputMint: to },
	},
	{
		id: `${id}c`,
		type: "trade.completed",
		occurredAt: at,
		payload: { tradeId: id, inputAmount: spent, outputAmount: got },
	},
];
const machine = (id: string) =>
	({
		machineId: id,
		name: id,
		kind: "range",
		result: { simulated: false },
	}) as unknown as MachineSummary;
const now = Date.parse("2026-09-28T12:00:00Z");

describe("the leaderboard", () => {
	const a = [
		...trade("a1", USDC, SOL, "10000000", "100", "2026-09-20T00:00:00Z"),
		...trade("a2", SOL, USDC, "100", "13000000", "2026-09-20T01:00:00Z"),
	];
	const b = [
		...trade("b1", USDC, SOL, "10000000", "100", "2026-09-28T06:00:00Z"),
		...trade("b2", SOL, USDC, "100", "11000000", "2026-09-28T07:00:00Z"),
	];

	it("ranks machines by what they realized, best first", () => {
		const board = standings(
			[
				{ machine: machine("a"), record: a },
				{ machine: machine("b"), record: b },
			],
			"ALL",
			now,
		);
		expect(board.map((s) => [s.machineId, s.realised])).toEqual([
			["a", 3_000_000n],
			["b", 1_000_000n],
		]);
	});

	it("only counts sales inside the window", () => {
		const board = standings(
			[
				{ machine: machine("a"), record: a },
				{ machine: machine("b"), record: b },
			],
			"1D",
			now,
		);
		expect(board.map((s) => [s.machineId, s.realised])).toEqual([
			["b", 1_000_000n],
			["a", 0n],
		]);
	});
});
