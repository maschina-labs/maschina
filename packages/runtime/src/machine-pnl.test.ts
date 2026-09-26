import { describe, expect, it } from "vitest";
import { machinePnl } from "./machine-pnl.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

let clock = 0;
const event = (type: string, payload: object) =>
	({
		id: `01a0df00-0000-7000-8000-${String(clock++).padStart(12, "0")}`,
		machineId: "01a0de78-31e2-7909-8328-7ad43fc8cc2d",
		type,
		payload,
		occurredAt: new Date(2026, 8, 26, 9, clock),
	}) as never;

/** A buy: intended names the mints, completed says what really happened. */
const bought = (tradeId: string, spend: string, got: string, fee = "5000") => [
	event("trade.intended", {
		runId: "r",
		tradeId,
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: spend,
		quotedOutputAmount: got,
	}),
	event("trade.completed", {
		runId: "r",
		tradeId,
		signature: "5".repeat(88),
		inputAmount: spend,
		outputAmount: got,
		feeLamports: fee,
	}),
];

const sold = (tradeId: string, give: string, got: string, fee = "5000") => [
	event("trade.intended", {
		runId: "r",
		tradeId,
		inputMint: SOL,
		outputMint: USDC,
		inputAmount: give,
		quotedOutputAmount: got,
	}),
	event("trade.completed", {
		runId: "r",
		tradeId,
		signature: "5".repeat(88),
		inputAmount: give,
		outputAmount: got,
		feeLamports: fee,
	}),
];

const of = (...groups: unknown[][]) => machinePnl(groups.flat() as never, { budgetMint: USDC });

describe("whether a machine has made money", () => {
	it("is nothing before it has traded", () => {
		expect(of()).toMatchObject({ realised: 0n, position: 0n, basis: 0n, roundTrips: 0 });
	});

	it("is nothing after a buy, because nothing is realised until it is sold", () => {
		// The position may be worth more or less. Until it is closed that is an opinion, not a result.
		expect(of(bought("t1", "5000000", "41000000"))).toMatchObject({
			realised: 0n,
			position: 41_000_000n,
			basis: 5_000_000n,
		});
	});

	it("is the difference, once a round trip closes", () => {
		const pnl = of(bought("t1", "5000000", "41000000"), sold("t2", "41000000", "5100000"));

		expect(pnl).toMatchObject({
			realised: 100_000n,
			position: 0n,
			basis: 0n,
			roundTrips: 1,
			wins: 1,
			losses: 0,
		});
	});

	it("is negative when a round trip loses, and says so plainly", () => {
		const pnl = of(bought("t1", "5000000", "41000000"), sold("t2", "41000000", "4900000"));

		expect(pnl).toMatchObject({ realised: -100_000n, losses: 1, wins: 0 });
	});

	it("uses average cost across several buys, so a partial sale is priced fairly", () => {
		// Ten dollars in for eighty tokens: an average of one eighth of a dollar each. Selling half the
		// position should carry half the cost.
		const pnl = of(
			bought("t1", "5000000", "40000000"),
			bought("t2", "5000000", "40000000"),
			sold("t3", "40000000", "5500000"),
		);

		expect(pnl).toMatchObject({ realised: 500_000n, position: 40_000_000n, basis: 5_000_000n });
	});

	it("counts what it really cost to send, separately from the profit", () => {
		// Fees are lamports and profit is dollars. Adding them would need a price, and a number that
		// quietly assumes one is worse than two numbers that do not.
		const pnl = of(
			bought("t1", "5000000", "41000000", "7000"),
			sold("t2", "41000000", "5100000", "8000"),
		);

		expect(pnl).toMatchObject({ realised: 100_000n, feesLamports: 15_000n });
	});

	it("counts a trade once, however often the record is read", () => {
		const twice = [...bought("t1", "5000000", "41000000"), ...bought("t1", "5000000", "41000000")];

		expect(machinePnl(twice as never, { budgetMint: USDC })).toMatchObject({
			position: 41_000_000n,
			basis: 5_000_000n,
		});
	});

	it("ignores a trade that never completed", () => {
		const attempted = [
			...bought("t1", "5000000", "41000000"),
			event("trade.intended", {
				runId: "r",
				tradeId: "t2",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: "5000000",
				quotedOutputAmount: "41000000",
			}),
			event("trade.failed", { runId: "r", tradeId: "t2", stage: "submit", reason: "expired" }),
		];

		expect(machinePnl(attempted as never, { budgetMint: USDC })).toMatchObject({
			position: 41_000_000n,
			basis: 5_000_000n,
			trades: 1,
		});
	});

	it("counts a simulated trade, so a machine on paper has a result too", () => {
		const onPaper = [
			event("trade.intended", {
				runId: "r",
				tradeId: "p1",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: "5000000",
				quotedOutputAmount: "41000000",
			}),
			event("trade.simulated", {
				runId: "r",
				tradeId: "p1",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: "5000000",
				quotedOutputAmount: "41000000",
			}),
		];

		const pnl = machinePnl(onPaper as never, { budgetMint: USDC });

		expect(pnl).toMatchObject({ position: 41_000_000n, basis: 5_000_000n, simulated: true });
		// A simulated trade never paid a fee, and pretending otherwise would flatter paper mode.
		expect(pnl.feesLamports).toBe(0n);
	});

	it("says nothing about a currency it was not told to count in", () => {
		expect(machinePnl(bought("t1", "5000000", "41000000") as never, {}).realised).toBe(0n);
	});
});
