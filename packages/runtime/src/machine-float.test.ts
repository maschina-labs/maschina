import { describe, expect, it } from "vitest";
import { machineFloat } from "./machine-float.ts";
import { paperHoldings } from "./paper-holdings.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const VAULT = "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk";

/** Fifty dollars, at six decimals. */
const FLOAT = 50_000_000n;

let clock = 0;
const event = (type: string, payload: object) =>
	({
		id: `01a0df00-0000-7000-8000-${String(clock++).padStart(12, "0")}`,
		machineId: "01a0de78-31e2-7909-8328-7ad43fc8cc2d",
		type,
		payload,
		occurredAt: new Date(2026, 8, 26, 9, clock),
	}) as never;

const granted = (to = FLOAT) => [
	event("machine.limits_changed", { limit: "budgetGranted", from: null, to: to.toString() }),
];

const trade = (
	tradeId: string,
	from: string,
	to: string,
	spend: bigint,
	got: bigint,
	outcome: "trade.completed" | "trade.simulated" = "trade.completed",
) => [
	event("trade.intended", {
		runId: "r",
		tradeId,
		inputMint: from,
		outputMint: to,
		inputAmount: spend.toString(),
		quotedOutputAmount: got.toString(),
	}),
	outcome === "trade.completed"
		? event("trade.completed", {
				runId: "r",
				tradeId,
				signature: "5".repeat(88),
				inputAmount: spend.toString(),
				outputAmount: got.toString(),
				feeLamports: "5000",
			})
		: event("trade.simulated", {
				runId: "r",
				tradeId,
				inputMint: from,
				outputMint: to,
				inputAmount: spend.toString(),
				quotedOutputAmount: got.toString(),
			}),
];

const bought = (id: string, spend: bigint, got: bigint) => trade(id, USDC, SOL, spend, got);
const sold = (id: string, give: bigint, got: bigint) => trade(id, SOL, USDC, give, got);

/** A buy with no outcome yet: budget is reserved and the answer has not come back. */
const buying = (id: string, spend: bigint) => [
	event("trade.intended", {
		runId: "r",
		tradeId: id,
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: spend.toString(),
		quotedOutputAmount: "1",
	}),
];

const swept = (id: string, amount: bigint) => [
	event("sweep.requested", {
		sweepId: id,
		to: VAULT,
		mint: USDC,
		amount: amount.toString(),
		value: (FLOAT + amount).toString(),
		floatTarget: FLOAT.toString(),
	}),
	event("sweep.completed", {
		sweepId: id,
		to: VAULT,
		mint: USDC,
		amount: amount.toString(),
		signature: "5".repeat(88),
		feeLamports: "5000",
		slot: "426070577",
	}),
];

/** `holding` is what the trading account has of the budget currency, as the chain would report it. */
const of = (holding: bigint, ...groups: unknown[][]) =>
	machineFloat(groups.flat() as never, { budgetMint: USDC, holding });

describe("a machine's float", () => {
	it("is the grant, and a funded machine starts exactly on it", () => {
		const float = of(FLOAT, granted());

		expect(float.target).toBe(FLOAT);
		expect(float.value).toBe(FLOAT);
		expect(float.surplus).toBe(0n);
		expect(float.deficit).toBe(0n);
		expect(float.flat).toBe(true);
	});

	it("is above the line by what a round trip earned", () => {
		// Fifteen dollars out, sixteen back. The dollar is profit and the fifty is untouched.
		const float = of(
			FLOAT + 1_000_000n,
			granted(),
			bought("t1", 15_000_000n, 123_000_000n),
			sold("t1s", 123_000_000n, 16_000_000n),
		);

		expect(float.value).toBe(FLOAT + 1_000_000n);
		expect(float.surplus).toBe(1_000_000n);
		expect(float.target).toBe(FLOAT);
	});

	it("is below the line by what a round trip lost", () => {
		const float = of(
			FLOAT - 1_000_000n,
			granted(),
			bought("t1", 15_000_000n, 123_000_000n),
			sold("t1s", 123_000_000n, 14_000_000n),
		);

		expect(float.deficit).toBe(1_000_000n);
		expect(float.surplus).toBe(0n);
	});

	it("is defined while the machine is holding the other side, carrying it at cost", () => {
		// This is what makes the float a number at every moment: the part that is in the market is worth
		// what was paid for it, which never moves on a price nobody has agreed to.
		const float = of(FLOAT - 15_000_000n, granted(), bought("t1", 15_000_000n, 123_000_000n));

		expect(float.value).toBe(FLOAT);
		expect(float.basis).toBe(15_000_000n);
		expect(float.position).toBe(123_000_000n);
		expect(float.flat).toBe(false);
	});

	it("is measured, not assumed, so money arriving in the wallet is seen", () => {
		// The record never sees a transfer in: money arrives in a wallet without asking Maschina. A float
		// worked out from the grant alone would report fifty here and be wrong by ten.
		const float = of(FLOAT + 10_000_000n, granted());

		expect(float.value).toBe(FLOAT + 10_000_000n);
		expect(float.surplus).toBe(10_000_000n);
	});
});

describe("what has been banked", () => {
	it("is nothing until a sweep completes", () => {
		expect(of(FLOAT, granted()).banked).toBe(0n);
	});

	it("is the sum of the completed sweeps, so the vault can be rebuilt from the record", () => {
		const float = of(FLOAT, granted(), swept("s1", 1_000_000n), swept("s2", 2_500_000n));

		expect(float.banked).toBe(3_500_000n);
	});

	it("counts a sweep once, however many times the record is read", () => {
		const one = swept("s1", 1_000_000n);
		expect(of(FLOAT, granted(), one, one).banked).toBe(1_000_000n);
	});

	it("ignores a sweep that was asked for and never landed", () => {
		const float = of(FLOAT, granted(), [
			event("sweep.requested", {
				sweepId: "s1",
				to: VAULT,
				mint: USDC,
				amount: "1000000",
				value: "51000000",
				floatTarget: "50000000",
			}),
			event("sweep.failed", { sweepId: "s1", reason: "the transaction expired" }),
		]);

		expect(float.banked).toBe(0n);
	});

	it("leaves the float on its line, because what was swept was never part of it", () => {
		const earned = [
			bought("t1", 15_000_000n, 123_000_000n),
			sold("t1s", 123_000_000n, 16_000_000n),
		];
		const before = of(FLOAT + 1_000_000n, granted(), ...earned);
		const after = of(FLOAT, granted(), ...earned, swept("s1", 1_000_000n));

		expect(before.surplus).toBe(1_000_000n);
		expect(after.surplus).toBe(0n);
		expect(after.value).toBe(FLOAT);
		expect(after.target).toBe(before.target);
		expect(after.banked).toBe(1_000_000n);
	});
});

describe("whether the machine is flat", () => {
	it("is true on a machine that has never traded", () => {
		expect(of(FLOAT, granted()).flat).toBe(true);
	});

	it("is false while it holds a position", () => {
		expect(of(45_000_000n, granted(), bought("t1", 5_000_000n, 41_000_000n)).flat).toBe(false);
	});

	it("is true again once the position is closed", () => {
		const float = of(
			FLOAT,
			granted(),
			bought("t1", 5_000_000n, 41_000_000n),
			sold("t1s", 41_000_000n, 5_000_000n),
		);

		expect(float.flat).toBe(true);
	});

	it("is false while a trade is in flight, whatever the account holds", () => {
		// Nothing bought and nothing sold, but budget is reserved and the answer is coming. Sweeping now
		// races the trade for the same money.
		const float = of(FLOAT, granted(), buying("t1", 5_000_000n));

		expect(float.flat).toBe(false);
	});
});

describe("whether to sweep", () => {
	it("says no on a machine sitting on its float", () => {
		expect(of(FLOAT, granted()).sweep.sweep).toBe(false);
	});

	it("says yes once profit clears the threshold, for the whole surplus", () => {
		const float = of(
			FLOAT + 1_500_000n,
			granted(),
			bought("t1", 15_000_000n, 123_000_000n),
			sold("t1s", 123_000_000n, 16_500_000n),
		);

		expect(float.sweep.sweep).toBe(true);
		expect(float.sweep.amount).toBe(1_500_000n);
	});

	it("says no while the machine is holding, however far ahead it looks", () => {
		// Fifty out, thirty-five left, twenty back, five spent again: fifty in the account and five in the
		// market, so the machine is five ahead and none of it can be banked yet.
		const float = of(
			FLOAT,
			granted(),
			bought("t1", 15_000_000n, 123_000_000n),
			sold("t1s", 123_000_000n, 20_000_000n),
			bought("t2", 5_000_000n, 40_000_000n),
		);

		expect(float.surplus).toBe(5_000_000n);
		expect(float.sweep.sweep).toBe(false);
	});

	it("says no a second time for profit that has already been banked", () => {
		const earned = [
			bought("t1", 15_000_000n, 123_000_000n),
			sold("t1s", 123_000_000n, 16_500_000n),
		];

		expect(of(FLOAT + 1_500_000n, granted(), ...earned).sweep.sweep).toBe(true);
		expect(of(FLOAT, granted(), ...earned, swept("s1", 1_500_000n)).sweep.sweep).toBe(false);
	});

	it("banks the difference when an owner lowers the float below what the machine holds", () => {
		// Lowering the line is a decision to take money off the table, and this is how it comes off.
		const float = of(FLOAT, granted(), granted(40_000_000n));

		expect(float.target).toBe(40_000_000n);
		expect(float.surplus).toBe(10_000_000n);
		expect(float.sweep.sweep).toBe(true);
	});

	it("says no for a machine with no grant to measure against", () => {
		const float = of(FLOAT);

		expect(float.target).toBe(0n);
		expect(float.sweep.sweep).toBe(false);
	});

	it("says no when the machine's budget has no currency", () => {
		const float = machineFloat(granted().flat() as never, { holding: FLOAT });

		expect(float.target).toBe(0n);
		expect(float.value).toBe(0n);
		expect(float.sweep.sweep).toBe(false);
	});
});

describe("a machine on paper", () => {
	it("has a float that behaves exactly as a funded one would", () => {
		// Its wallet stays empty, so what it holds comes from the record instead of the chain.
		const events = [
			...granted(),
			...trade("t1", USDC, SOL, 15_000_000n, 123_000_000n, "trade.simulated"),
			...trade("t1s", SOL, USDC, 123_000_000n, 16_500_000n, "trade.simulated"),
		];
		const held = paperHoldings(events as never).get(USDC) ?? 0n;
		const float = machineFloat(events as never, { budgetMint: USDC, holding: FLOAT + held });

		expect(held).toBe(1_500_000n);
		expect(float.surplus).toBe(1_500_000n);
		expect(float.sweep.sweep).toBe(true);
		expect(float.simulated).toBe(true);
	});
});
