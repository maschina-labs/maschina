import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { MachineView } from "../machine-kind.ts";
import { type PriceTriggerSettings, priceTrigger } from "./price-trigger.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const settings = {
	spendMint: USDC,
	buyMint: SOL,
	level: "142000000",
	direction: "falls_to",
	amountPerTrade: "5000000",
	slippageBps: 50,
	hysteresisBps: 50,
	minGapMs: 900_000,
};

const view = (overrides: Partial<MachineView> = {}): MachineView => ({
	balances: new Map([[USDC, baseUnitsOf(50_000_000n)]]),
	availableBudget: baseUnitsOf(20_000_000n),
	now: new Date("2026-09-21T09:00:00Z"),
	totals: { spent: baseUnitsOf(0n), buys: 0 },
	...overrides,
});

const read = (raw: unknown) => priceTrigger.readSettings(raw);
const settingsOf = (raw: unknown): PriceTriggerSettings => {
	const parsed = read(raw);
	if (!parsed.ok) throw new Error(parsed.problem);
	return parsed.value;
};

describe("what a price trigger machine needs to be told", () => {
	it("takes the level, the direction, the amount and the limits", () => {
		expect(settingsOf(settings)).toMatchObject({
			spendMint: USDC,
			buyMint: SOL,
			level: 142_000_000n,
			direction: "falls_to",
			amountPerTrade: 5_000_000n,
			hysteresisBps: 50,
			minGapMs: 900_000,
		});
	});

	it("refuses settings that would make it trade wrongly", () => {
		const bad = (change: object, problem: RegExp) => {
			const parsed = read({ ...settings, ...change });
			expect(parsed.ok).toBe(false);
			expect(!parsed.ok && parsed.problem).toMatch(problem);
		};

		bad({ spendMint: "nope" }, /spendMint/);
		bad({ buyMint: USDC }, /cannot buy the token it is spending/);
		bad({ level: "0" }, /level/);
		bad({ direction: "sideways" }, /direction/);
		bad({ amountPerTrade: "0" }, /amountPerTrade/);
		bad({ slippageBps: 20_000 }, /slippageBps/);
		bad({ hysteresisBps: -5 }, /hysteresisBps/);
		bad({ minGapMs: -1 }, /minGapMs/);
	});

	it("takes amounts as numbers too, the way the record stores them", () => {
		expect(
			settingsOf({ ...settings, level: 142_000_000n, amountPerTrade: 5_000_000n }),
		).toMatchObject({
			level: 142_000_000n,
			amountPerTrade: 5_000_000n,
		});
	});

	it("refuses a total to stop at that is not an amount, or smaller than one trade", () => {
		const nonsense = read({ ...settings, stopAfterTotal: "many" });
		expect(!nonsense.ok && nonsense.problem).toMatch(/stopAfterTotal/);
		const tooSmall = read({ ...settings, stopAfterTotal: "1000" });
		expect(!tooSmall.ok && tooSmall.problem).toMatch(/less than one trade/);
	});

	it("refuses settings that are not an object at all", () => {
		expect(read("a machine").ok).toBe(false);
		expect(read(null).ok).toBe(false);
	});

	it("defaults the hysteresis and the gap, so a machine cannot be created without them", () => {
		const { hysteresisBps, minGapMs, ...bare } = settings;
		expect(settingsOf(bare)).toMatchObject({ hysteresisBps: 50, minGapMs: 3_600_000 });
	});
});

describe("what a price trigger machine does when its run comes", () => {
	it("buys the amount it was told to, because the level already fired", () => {
		// The level is watched outside the machine. A run means the price crossed it.
		expect(priceTrigger.decide(settingsOf(settings), view())).toEqual({
			decide: "act",
			action: {
				do: "swap",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: 5_000_000n,
				slippageBps: 50,
			},
			because: "the price crossed 142000000, falls_to",
		});
	});

	it("waits when the budget cannot cover the trade", () => {
		const decision = priceTrigger.decide(
			settingsOf(settings),
			view({ availableBudget: baseUnitsOf(1_000_000n) }),
		);
		expect(decision).toMatchObject({ decide: "wait", because: "budget_exhausted" });
	});

	it("waits when the wallet does not hold enough to spend", () => {
		const decision = priceTrigger.decide(
			settingsOf(settings),
			view({ balances: new Map([[USDC, baseUnitsOf(1_000_000n)]]) }),
		);
		expect(decision).toMatchObject({ decide: "wait", because: "balance_too_low" });
	});

	it("stops when what is left of the total is less than one trade", () => {
		const capped = settingsOf({ ...settings, stopAfterTotal: "12000000" });
		const decision = priceTrigger.decide(
			capped,
			view({ totals: { spent: baseUnitsOf(9_000_000n), buys: 1 } }),
		);
		expect(decision).toMatchObject({
			decide: "stop",
			because: expect.stringContaining("last one"),
		});
	});

	it("stops once it has spent the total it was given", () => {
		const capped = settingsOf({ ...settings, stopAfterTotal: "10000000" });
		const decision = priceTrigger.decide(
			capped,
			view({ totals: { spent: baseUnitsOf(10_000_000n), buys: 2 } }),
		);
		expect(decision).toMatchObject({ decide: "stop" });
	});
});

describe("which token the level is a price of", () => {
	const base = {
		spendMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		buyMint: "So11111111111111111111111111111111111111112",
		level: "108000000",
		direction: "falls_to",
		amountPerTrade: "5000000",
		slippageBps: 50,
	};

	it("prices what is being bought, for a machine that buys", () => {
		const read = priceTrigger.readSettings(base);

		expect(read.ok).toBe(true);
		if (read.ok) expect(read.value.pricedMint).toBe(base.buyMint);
	});

	it("prices what is being sold, when a machine says so", () => {
		// Selling SOL for dollars watches the price of SOL, not the price of the dollar.
		const read = priceTrigger.readSettings({
			...base,
			spendMint: base.buyMint,
			buyMint: base.spendMint,
			pricedMint: base.buyMint,
			direction: "rises_to",
		});

		expect(read.ok).toBe(true);
		if (read.ok) expect(read.value.pricedMint).toBe(base.buyMint);
	});

	it("refuses a token the machine does not touch", () => {
		const read = priceTrigger.readSettings({
			...base,
			pricedMint: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
		});

		expect(read.ok).toBe(false);
	});
});

describe("the currency this machine's budget is counted in", () => {
	it("is what it spends, so selling back into it returns the money", () => {
		expect(priceTrigger.budgetMint?.(settingsOf(settings))).toBe(USDC);
	});

	it("follows the machine round, for one that sells instead of buying", () => {
		const selling = settingsOf({
			...settings,
			spendMint: SOL,
			buyMint: USDC,
			pricedMint: SOL,
			direction: "rises_to",
		});

		expect(priceTrigger.budgetMint?.(selling)).toBe(SOL);
	});
});
