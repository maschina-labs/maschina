import { baseUnitsOf } from "@maschina/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decideFor, type MachineView } from "../machine-kind.ts";
import { recurringBuy } from "./recurring-buy.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const amount = (value: bigint) => baseUnitsOf(value);

const settings = (overrides: Record<string, unknown> = {}) => ({
	spendMint: USDC,
	buyMint: SOL,
	amountPerBuy: "25000000",
	slippageBps: 50,
	...overrides,
});

const view = (overrides: Partial<MachineView> = {}): MachineView => ({
	balances: new Map([[USDC, amount(100_000_000n)]]),
	availableBudget: amount(500_000_000n),
	now: new Date("2026-06-15T15:00:00Z"),
	totals: { spent: amount(0n), buys: 0 },
	...overrides,
});

const read = (raw: Record<string, unknown>) => recurringBuy.readSettings(raw);

describe("recurring buy settings", () => {
	it("reads a sound recipe", () => {
		const result = read(settings());
		expect(result.ok && result.value).toMatchObject({
			spendMint: USDC,
			buyMint: SOL,
			amountPerBuy: 25_000_000n,
			slippageBps: 50,
		});
	});

	it("takes the amount as a string or a bigint, since the record holds strings", () => {
		expect(read(settings({ amountPerBuy: 25_000_000n })).ok).toBe(true);
		expect(read(settings({ amountPerBuy: "25000000" })).ok).toBe(true);
	});

	it("refuses a recipe that isn't an object", () => {
		for (const bad of [null, undefined, 5, "settings", []]) {
			const result = recurringBuy.readSettings(bad);
			expect(result.ok, String(bad)).toBe(false);
		}
	});

	it("refuses tokens that aren't token addresses", () => {
		expect(read(settings({ spendMint: "nope" })).ok).toBe(false);
		expect(read(settings({ buyMint: 42 })).ok).toBe(false);
	});

	it("refuses buying the token it is spending", () => {
		const result = read(settings({ buyMint: USDC }));
		expect(!result.ok && result.problem).toMatch(/cannot buy the token it is spending/);
	});

	it("refuses an amount that isn't a whole number above zero", () => {
		for (const bad of ["0", "-5", "1.5", "", "lots", 0n, -1n, 5.5]) {
			expect(read(settings({ amountPerBuy: bad })).ok, String(bad)).toBe(false);
		}
	});

	it("refuses a total smaller than one buy, which could never buy anything", () => {
		const result = read(settings({ stopAfterTotal: "10000000" }));
		expect(!result.ok && result.problem).toMatch(/less than one buy/);
	});

	it("refuses slippage that isn't a whole percentage in range", () => {
		for (const bad of [-1, 10_001, 1.5, "50", Number.NaN]) {
			expect(read(settings({ slippageBps: bad })).ok, String(bad)).toBe(false);
		}
	});

	it("allows a machine with no total, which runs until it is stopped", () => {
		const result = read(settings());
		expect(result.ok && "stopAfterTotal" in result.value).toBe(false);
	});
});

describe("recurring buy decisions", () => {
	const decide = (raw: Record<string, unknown>, v: MachineView) => decideFor(recurringBuy, raw, v);

	it("buys when it is due and can afford it", () => {
		const decision = decide(settings(), view());
		expect(decision).toMatchObject({
			decide: "act",
			action: {
				do: "swap",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: 25_000_000n,
				slippageBps: 50,
			},
		});
	});

	it("waits when the wallet is short, saying how short", () => {
		const decision = decide(settings(), view({ balances: new Map([[USDC, amount(1_000_000n)]]) }));
		expect(decision).toMatchObject({ decide: "wait", because: "balance_too_low" });
		expect(decision.decide === "wait" && decision.detail).toContain("25000000");
	});

	it("waits when the wallet holds none of the token at all", () => {
		const decision = decide(settings(), view({ balances: new Map() }));
		expect(decision).toMatchObject({ decide: "wait", because: "balance_too_low" });
	});

	it("waits when the budget is spent, even with money in the wallet", () => {
		const decision = decide(settings(), view({ availableBudget: amount(1n) }));
		expect(decision).toMatchObject({ decide: "wait", because: "budget_exhausted" });
	});

	it("stops once the total is reached", () => {
		const decision = decide(
			settings({ stopAfterTotal: "100000000" }),
			view({ totals: { spent: amount(100_000_000n), buys: 4 } }),
		);
		expect(decision).toMatchObject({ decide: "stop" });
	});

	it("stops when what is left is less than one buy", () => {
		const decision = decide(
			settings({ stopAfterTotal: "100000000" }),
			view({ totals: { spent: amount(90_000_000n), buys: 3 } }),
		);
		expect(decision.decide).toBe("stop");
		expect(decision.decide === "stop" && decision.because).toMatch(/last one/);
	});

	it("buys the last full buy before stopping", () => {
		const decision = decide(
			settings({ stopAfterTotal: "100000000" }),
			view({ totals: { spent: amount(75_000_000n), buys: 3 } }),
		);
		expect(decision.decide).toBe("act");
	});

	it("waits, rather than guessing, when the recipe is malformed", () => {
		const decision = decide(settings({ amountPerBuy: "nonsense" }), view());
		expect(decision).toMatchObject({ decide: "wait" });
		expect(decision.decide === "wait" && decision.detail).toMatch(/amountPerBuy/);
	});

	it("checks the total before the money, so a finished machine stops rather than complaining", () => {
		const decision = decide(
			settings({ stopAfterTotal: "50000000" }),
			view({ totals: { spent: amount(50_000_000n), buys: 2 }, availableBudget: amount(0n) }),
		);
		expect(decision.decide).toBe("stop");
	});
});

describe("recurring buy, for any situation", () => {
	const anyView = fc.record({
		balance: fc.bigInt({ min: 0n, max: 1_000_000_000n }),
		availableBudget: fc.bigInt({ min: 0n, max: 1_000_000_000n }),
		spent: fc.bigInt({ min: 0n, max: 1_000_000_000n }),
		amountPerBuy: fc.bigInt({ min: 1n, max: 100_000_000n }),
		stopAfterTotal: fc.option(fc.bigInt({ min: 1n, max: 1_000_000_000n }), { nil: undefined }),
	});

	it("never proposes spending more than the wallet holds or the budget allows", () => {
		fc.assert(
			fc.property(anyView, (v) => {
				const decision = decideFor(
					recurringBuy,
					settings({
						amountPerBuy: v.amountPerBuy.toString(),
						...(v.stopAfterTotal === undefined
							? {}
							: { stopAfterTotal: v.stopAfterTotal.toString() }),
					}),
					view({
						balances: new Map([[USDC, amount(v.balance)]]),
						availableBudget: amount(v.availableBudget),
						totals: { spent: amount(v.spent), buys: 0 },
					}),
				);
				if (decision.decide !== "act") return;
				expect(decision.action.inputAmount).toBeLessThanOrEqual(v.balance);
				expect(decision.action.inputAmount).toBeLessThanOrEqual(v.availableBudget);
			}),
			{ numRuns: 2000 },
		);
	});

	it("never spends past the total it was told to stop at", () => {
		fc.assert(
			fc.property(anyView, (v) => {
				if (v.stopAfterTotal === undefined) return;
				const decision = decideFor(
					recurringBuy,
					settings({
						amountPerBuy: v.amountPerBuy.toString(),
						stopAfterTotal: v.stopAfterTotal.toString(),
					}),
					view({
						balances: new Map([[USDC, amount(v.balance)]]),
						availableBudget: amount(v.availableBudget),
						totals: { spent: amount(v.spent), buys: 0 },
					}),
				);
				if (decision.decide !== "act") return;
				expect(v.spent + decision.action.inputAmount).toBeLessThanOrEqual(v.stopAfterTotal);
			}),
			{ numRuns: 2000 },
		);
	});

	it("always gives one of the three decisions, and never throws", () => {
		fc.assert(
			fc.property(fc.anything(), (raw) => {
				const decision = decideFor(recurringBuy, raw, view());
				expect(["act", "wait", "stop"]).toContain(decision.decide);
			}),
			{ numRuns: 1000 },
		);
	});
});
