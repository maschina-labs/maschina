import { followingRange } from "@maschina/runtime";
import { describe, expect, it } from "vitest";
import type { MachineDetail } from "./machines.ts";
import { bandOf, statusOf } from "./status.ts";

const machine = (state: MachineDetail["state"], position = "0") =>
	({
		state,
		settings: { buyLevel: "118800000", sellLevel: "121200000" },
		result: { position },
	}) as unknown as MachineDetail;

describe("what a machine is doing", () => {
	it("waits to buy while it holds nothing", () => {
		expect(statusOf(machine("running"))).toBe("WAITING TO BUY AT 118.80");
	});

	it("waits to sell while it holds a position", () => {
		expect(statusOf(machine("running", "339000000"))).toBe("HOLDING · SELLS AT 121.20");
	});

	it("says its state when it is not running", () => {
		expect(statusOf(machine("paused"))).toBe("PAUSED");
	});
});

describe("the band on the chart", () => {
	it("gives the sell line above the buy line, in dollars", () => {
		expect(bandOf(machine("running"))).toEqual([
			{ price: 121.2, label: "SELL" },
			{ price: 118.8, label: "BUY" },
		]);
	});
});

describe("a machine whose band follows the price", () => {
	const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
	const SOL = "So11111111111111111111111111111111111111112";
	const following = (position = "0") =>
		({
			kind: followingRange.kind,
			state: "running",
			settings: {
				quoteMint: USDC,
				baseMint: SOL,
				bandBps: 250,
				floorBps: 800,
				amountPerBuy: "40350000",
			},
			result: { position },
		}) as unknown as MachineDetail;
	const at = (minute: number) => `2026-09-28T19:${String(minute).padStart(2, "0")}:00.000Z`;
	const entry = (type: string, payload: Record<string, unknown>, minute: number) => ({
		id: `${type}${minute}`,
		type,
		occurredAt: at(minute),
		payload,
	});
	const centered = entry("machine.recentred", { price: "120000000", because: "started" }, 1);
	const bought = [
		entry(
			"trade.intended",
			{ runId: "r", tradeId: "t", inputMint: USDC, outputMint: SOL, inputAmount: "40350000" },
			2,
		),
		entry(
			"trade.completed",
			{
				runId: "r",
				tradeId: "t",
				signature: "s",
				inputAmount: "40350000",
				outputAmount: "339698787",
				feeLamports: "0",
			},
			3,
		),
	];

	it("waits to buy half a band under where it sits, and draws both edges", () => {
		// Newest first, the way the record arrives.
		const record = [centered];
		expect(statusOf(following(), record)).toBe("WAITING TO BUY AT 118.50");
		expect(bandOf(following(), record)).toEqual([
			{ price: 121.5, label: "FOLLOW" },
			{ price: 118.5, label: "BUY" },
		]);
	});

	it("sells a band above what it paid, and shows its floor", () => {
		const record = [...bought].reverse().concat(centered);
		expect(statusOf(following("339698787"), record)).toBe("HOLDING · SELLS AT 121.75");
		expect(bandOf(following("339698787"), record).map((each) => each.label)).toEqual([
			"SELL",
			"FLOOR",
		]);
	});
});

describe("the band the API sends", () => {
	it("is drawn as sent, whatever part of the record the app has", () => {
		const sent = {
			kind: followingRange.kind,
			state: "running",
			settings: {},
			result: { position: "339698787" },
			levels: [
				{ id: "floor", price: "109280000", direction: "falls_to" },
				{ id: "sell", price: "121750000", direction: "rises_to" },
			],
		} as unknown as MachineDetail;

		expect(statusOf(sent, [])).toBe("HOLDING · SELLS AT 121.75");
		expect(bandOf(sent, [])).toEqual([
			{ price: 121.75, label: "SELL" },
			{ price: 109.28, label: "FLOOR" },
		]);
	});
});
