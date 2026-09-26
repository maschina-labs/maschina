import { describe, expect, it } from "vitest";
import { paperHoldings } from "./paper-holdings.ts";

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

const bought = (tradeId: string, spend: string, got: string) =>
	event("trade.simulated", {
		runId: "r",
		tradeId,
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: spend,
		quotedOutputAmount: got,
	});

const sold = (tradeId: string, give: string, got: string) =>
	event("trade.simulated", {
		runId: "r",
		tradeId,
		inputMint: SOL,
		outputMint: USDC,
		inputAmount: give,
		quotedOutputAmount: got,
	});

describe("what a machine on paper holds", () => {
	it("is nothing before it has done anything", () => {
		expect(paperHoldings([])).toEqual(new Map());
	});

	it("is what it bought, after a simulated buy", () => {
		const held = paperHoldings([bought("t1", "5000000", "41000000")]);

		expect(held.get(SOL)).toBe(41_000_000n);
		// What it spent left the wallet, and a token it has none of is not a token it holds.
		expect(held.has(USDC)).toBe(false);
	});

	it("gives back what a sale took, so a round trip leaves the position closed", () => {
		const held = paperHoldings([
			bought("t1", "5000000", "41000000"),
			sold("t2", "41000000", "5100000"),
		]);

		// Out of the market entirely: this is what lets the next buy happen.
		expect(held.has(SOL)).toBe(false);
		expect(held.get(USDC)).toBe(100_000n);
	});

	it("counts a trade once, however often the record is read", () => {
		const twice = [bought("t1", "5000000", "41000000"), bought("t1", "5000000", "41000000")];

		expect(paperHoldings(twice).get(SOL)).toBe(41_000_000n);
	});

	it("ignores trades that really happened, because those are in the wallet already", () => {
		const real = event("trade.completed", {
			runId: "r",
			tradeId: "t9",
			inputMint: USDC,
			outputMint: SOL,
			inputAmount: "5000000",
			outputAmount: "41000000",
			signature: "s",
			feeLamports: "5000",
			slot: "1",
		});

		expect(paperHoldings([real])).toEqual(new Map());
	});

	it("never reports holding less than nothing", () => {
		// Selling what was never held should be impossible, because a machine refuses it. If it happens
		// anyway, the answer is still a balance, and no balance is negative.
		const held = paperHoldings([sold("t1", "41000000", "5100000")]);

		expect(held.has(SOL)).toBe(false);
		expect(held.get(USDC)).toBe(5_100_000n);
	});
});
