import type { RecordedEvent } from "@maschina/contracts";
import { baseUnitsOf } from "@maschina/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canAfford, machineBudget } from "./machine-budget.ts";

const MACHINE = "0199a0a0-0000-7000-8000-000000000001";
const RUN = "0199a0a0-0000-7000-8000-000000000002";
const trade = (n: number) => `0199a0a0-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`;

const event = (type: string, payload: unknown) =>
	({ machineId: MACHINE, type, payload }) as RecordedEvent;

const granted = (to: string) =>
	event("machine.limits_changed", { limit: "budgetGranted", from: null, to });
const intended = (id: string, inputAmount: string) =>
	event("trade.intended", {
		runId: RUN,
		tradeId: id,
		inputMint: "So11111111111111111111111111111111111111112",
		outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		inputAmount,
		quotedOutputAmount: "1",
		slippageBps: 50,
	});
const completed = (id: string, inputAmount: string, feeLamports = "5000") =>
	event("trade.completed", {
		runId: RUN,
		tradeId: id,
		signature: "5".repeat(88),
		inputAmount,
		outputAmount: "1",
		feeLamports,
	});
const failed = (id: string) =>
	event("trade.failed", { runId: RUN, tradeId: id, stage: "submit", reason: "blockhash expired" });
const refused = (id: string) =>
	event("trade.refused", {
		runId: RUN,
		tradeId: id,
		by: "provider",
		rule: "recipients",
		reason: "no",
	});

const numbers = (events: RecordedEvent[]) => {
	const budget = machineBudget(events);
	return {
		granted: budget.granted.toString(),
		reserved: budget.reserved.toString(),
		settled: budget.settled.toString(),
		available: budget.available.toString(),
	};
};

describe("machineBudget", () => {
	it("starts at nothing", () => {
		expect(numbers([])).toEqual({ granted: "0", reserved: "0", settled: "0", available: "0" });
	});

	it("takes what the owner granted", () => {
		expect(numbers([granted("1000000")]).available).toBe("1000000");
	});

	it("holds what an intended trade could cost", () => {
		const events = [granted("1000000"), intended(trade(1), "400000")];
		expect(numbers(events)).toMatchObject({
			reserved: "400000",
			settled: "0",
			available: "600000",
		});
	});

	it("settles what a trade really cost, including its fee, and frees the rest", () => {
		const events = [
			granted("1000000"),
			intended(trade(1), "400000"),
			completed(trade(1), "350000", "5000"),
		];
		expect(numbers(events)).toMatchObject({
			reserved: "0",
			settled: "355000",
			available: "645000",
		});
	});

	it("gives the money back when a trade fails or is refused", () => {
		for (const ending of [failed(trade(1)), refused(trade(1))]) {
			const events = [granted("1000000"), intended(trade(1), "400000"), ending];
			expect(numbers(events)).toMatchObject({ reserved: "0", settled: "0", available: "1000000" });
		}
	});

	it("never lets a trade cost more than it reserved", () => {
		const events = [
			granted("1000000"),
			intended(trade(1), "100000"),
			completed(trade(1), "900000", "5000"),
		];
		expect(numbers(events)).toMatchObject({ settled: "100000", available: "900000" });
	});

	it("ignores a trade that doesn't fit, rather than reserving more than exists", () => {
		const events = [granted("100000"), intended(trade(1), "500000")];
		expect(numbers(events)).toMatchObject({ reserved: "0", available: "100000" });
	});

	it("counts each trade once, however many times the record repeats it", () => {
		const events = [
			granted("1000000"),
			intended(trade(1), "400000"),
			intended(trade(1), "400000"),
			completed(trade(1), "400000", "0"),
			completed(trade(1), "400000", "0"),
		];
		expect(numbers(events)).toMatchObject({ settled: "400000", available: "600000" });
	});

	it("ignores an ending for a trade that never started", () => {
		expect(numbers([granted("1000"), completed(trade(9), "500"), failed(trade(8))])).toMatchObject({
			settled: "0",
			available: "1000",
		});
	});

	it("follows the owner raising and lowering the grant", () => {
		expect(numbers([granted("1000"), granted("5000")]).available).toBe("5000");
		expect(numbers([granted("5000"), granted("1000")]).available).toBe("1000");
	});

	it("won't drop the grant below what is already committed", () => {
		const events = [
			granted("1000000"),
			intended(trade(1), "400000"),
			completed(trade(1), "400000", "0"),
			granted("100000"),
		];
		expect(numbers(events)).toMatchObject({ granted: "400000", available: "0" });
	});

	it("ignores events that aren't about money", () => {
		const started = event("run.started", { runId: RUN, nodeId: MACHINE });
		const stopped = event("machine.stopped", { by: "owner" });
		const events = [granted("1000"), started, stopped, intended(trade(1), "400"), started];
		expect(numbers(events)).toMatchObject({ granted: "1000", reserved: "400", available: "600" });
	});

	it("reports how many trades are still holding money", () => {
		const events = [granted("1000000"), intended(trade(1), "100000"), intended(trade(2), "100000")];
		expect(machineBudget(events).openTrades).toBe(2);
	});

	it("says what the machine can still afford", () => {
		const budget = machineBudget([granted("1000"), intended(trade(1), "600")]);
		expect(canAfford(budget, baseUnitsOf(400n))).toBe(true);
		expect(canAfford(budget, baseUnitsOf(401n))).toBe(false);
	});
});

/** Random but valid sequences: grants, trades that start, and trades that end. */
const anyEvents = fc
	.array(
		fc.oneof(
			fc.record({ kind: fc.constant("grant"), value: fc.bigInt({ min: 0n, max: 10_000_000n }) }),
			fc.record({
				kind: fc.constant("intend"),
				id: fc.integer({ min: 1, max: 6 }),
				value: fc.bigInt({ min: 0n, max: 5_000_000n }),
			}),
			fc.record({
				kind: fc.constant("complete"),
				id: fc.integer({ min: 1, max: 6 }),
				value: fc.bigInt({ min: 0n, max: 5_000_000n }),
				fee: fc.bigInt({ min: 0n, max: 10_000n }),
			}),
			fc.record({ kind: fc.constant("fail"), id: fc.integer({ min: 1, max: 6 }) }),
			fc.record({ kind: fc.constant("refuse"), id: fc.integer({ min: 1, max: 6 }) }),
		),
		{ maxLength: 60 },
	)
	.map((steps) =>
		steps.map((step) => {
			switch (step.kind) {
				case "grant":
					return granted(step.value.toString());
				case "intend":
					return intended(trade(step.id), step.value.toString());
				case "complete":
					return completed(trade(step.id), step.value.toString(), step.fee.toString());
				case "fail":
					return failed(trade(step.id));
				default:
					return refused(trade(step.id));
			}
		}),
	);

describe("machineBudget, for any sequence of events at all", () => {
	it("never goes negative, and never lets the parts exceed the grant", () => {
		fc.assert(
			fc.property(anyEvents, (events) => {
				const budget = machineBudget(events);
				expect(budget.reserved >= 0n).toBe(true);
				expect(budget.settled >= 0n).toBe(true);
				expect(budget.available >= 0n).toBe(true);
				expect(budget.reserved + budget.settled <= budget.granted).toBe(true);
			}),
			{ numRuns: 3000 },
		);
	});

	it("always adds up: granted minus reserved minus settled is what is available", () => {
		fc.assert(
			fc.property(anyEvents, (events) => {
				const budget = machineBudget(events);
				expect(budget.available).toBe(budget.granted - budget.reserved - budget.settled);
			}),
			{ numRuns: 3000 },
		);
	});

	it("gives the same answer every time the record is read", () => {
		fc.assert(
			fc.property(anyEvents, (events) => {
				expect(machineBudget(events)).toEqual(machineBudget(events));
			}),
			{ numRuns: 500 },
		);
	});

	it("never spends more than was granted, however trades end", () => {
		fc.assert(
			fc.property(anyEvents, (events) => {
				const budget = machineBudget(events);
				expect(budget.settled <= budget.granted).toBe(true);
			}),
			{ numRuns: 2000 },
		);
	});
});

describe("the fee a trade will cost to send", () => {
	it("is held back along with what the trade spends", () => {
		const withFee = event("trade.intended", {
			runId: RUN,
			tradeId: trade(9),
			inputMint: "So11111111111111111111111111111111111111112",
			outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			inputAmount: "100",
			quotedOutputAmount: "1",
			slippageBps: 50,
			feeAllowance: "10",
		});

		const budget = machineBudget([granted("1000"), withFee]);

		expect(budget.reserved).toBe(110n);
		expect(budget.available).toBe(890n);
	});

	it("is nothing when the trade did not say, so older events read the same", () => {
		const budget = machineBudget([granted("1000"), intended(trade(8), "100")]);

		expect(budget.reserved).toBe(100n);
	});
});
