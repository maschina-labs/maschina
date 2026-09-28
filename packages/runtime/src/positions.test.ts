import { describe, expect, it } from "vitest";
import { positionsFrom } from "./positions.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

let clock = 0;
const event = (type: string, payload: object) =>
	({
		id: `01a0de80-0000-7000-8000-${String(clock++).padStart(12, "0")}`,
		machineId: "01a0de78-31e2-7909-8328-7ad43fc8cc2d",
		type,
		payload,
		occurredAt: new Date(),
	}) as never;

const intended = (tradeId: string, inputMint: string, outputMint: string, spend: string) =>
	event("trade.intended", {
		runId: "r",
		tradeId,
		inputMint,
		outputMint,
		inputAmount: spend,
		quotedOutputAmount: "1",
		slippageBps: 50,
	});

const completed = (tradeId: string, spent: string, got: string) =>
	event("trade.completed", {
		runId: "r",
		tradeId,
		signature: "s",
		inputAmount: spent,
		outputAmount: got,
		feeLamports: "5000",
	});

describe("what a machine holds from its own trades", () => {
	it("is nothing before it has traded, whatever its wallet holds", () => {
		expect(positionsFrom([]).size).toBe(0);
	});

	it("counts what a completed buy got", () => {
		const events = [
			intended("t1", USDC, SOL, "27750000"),
			completed("t1", "27750000", "232000000"),
		];
		expect(positionsFrom(events).get(SOL)).toBe(232_000_000n);
	});

	it("takes a sale off again, so a machine that sold holds nothing", () => {
		const events = [
			intended("t1", USDC, SOL, "27750000"),
			completed("t1", "27750000", "232000000"),
			intended("t2", SOL, USDC, "232000000"),
			completed("t2", "232000000", "28100000"),
		];
		expect(positionsFrom(events).has(SOL)).toBe(false);
	});

	it("ignores a trade that was only intended, because nothing moved", () => {
		expect(positionsFrom([intended("t1", USDC, SOL, "27750000")]).size).toBe(0);
	});

	it("counts a completed trade once, however often the record repeats it", () => {
		const events = [
			intended("t1", USDC, SOL, "27750000"),
			completed("t1", "27750000", "232000000"),
			completed("t1", "27750000", "232000000"),
		];
		expect(positionsFrom(events).get(SOL)).toBe(232_000_000n);
	});

	it("counts paper trades the same way, from what the quote said", () => {
		const events = [
			event("trade.simulated", {
				runId: "r",
				tradeId: "p1",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: "27750000",
				quotedOutputAmount: "231000000",
			}),
		];
		expect(positionsFrom(events).get(SOL)).toBe(231_000_000n);
	});

	it("never reports a negative holding of what a machine was funded with", () => {
		// A buy spends dollars the owner sent, not dollars a trade brought in.
		const events = [
			intended("t1", USDC, SOL, "27750000"),
			completed("t1", "27750000", "232000000"),
		];
		expect(positionsFrom(events).has(USDC)).toBe(false);
	});
});
