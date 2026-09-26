import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { MachineView } from "../machine-kind.ts";
import { type RangeSettings, range } from "./range.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const settings = {
	quoteMint: USDC,
	baseMint: SOL,
	buyLevel: "120000000",
	sellLevel: "130000000",
	amountPerBuy: "5000000",
	minBase: "1000000",
	slippageBps: 50,
	hysteresisBps: 50,
	minGapMs: 60_000,
};

const read = (raw: unknown) => range.readSettings(raw);
const settingsOf = (raw: unknown): RangeSettings => {
	const parsed = read(raw);
	if (!parsed.ok) throw new Error(parsed.problem);
	return parsed.value;
};

/** Holding nothing but dollars, which is where a range machine starts. */
const view = (overrides: Partial<MachineView> = {}): MachineView => ({
	balances: new Map([[USDC, baseUnitsOf(50_000_000n)]]),
	availableBudget: baseUnitsOf(50_000_000n),
	now: new Date("2026-09-26T09:00:00Z"),
	totals: { spent: baseUnitsOf(0n), buys: 0 },
	...overrides,
});

/** Holding a position: enough SOL to count as in the market. */
const holding = (overrides: Partial<MachineView> = {}) =>
	view({
		balances: new Map([
			[USDC, baseUnitsOf(45_000_000n)],
			[SOL, baseUnitsOf(41_000_000n)],
		]),
		availableBudget: baseUnitsOf(45_000_000n),
		...overrides,
	});

describe("what a range machine needs to be told", () => {
	it("takes both edges, the amount, and what counts as holding a position", () => {
		expect(settingsOf(settings)).toMatchObject({
			quoteMint: USDC,
			baseMint: SOL,
			buyLevel: 120_000_000n,
			sellLevel: 130_000_000n,
			amountPerBuy: 5_000_000n,
			minBase: 1_000_000n,
		});
	});

	it("refuses a band that is upside down, which would buy high and sell low", () => {
		const upsideDown = read({ ...settings, buyLevel: "130000000", sellLevel: "120000000" });
		expect(upsideDown.ok).toBe(false);
	});

	it("refuses a band with no width at all", () => {
		expect(read({ ...settings, sellLevel: settings.buyLevel }).ok).toBe(false);
	});

	it("refuses trading a token against itself", () => {
		expect(read({ ...settings, baseMint: USDC }).ok).toBe(false);
	});

	it("refuses an amount of nothing", () => {
		expect(read({ ...settings, amountPerBuy: "0" }).ok).toBe(false);
	});
});

describe("the edges a range machine waits on", () => {
	it("watches both, priced in the token it trades, each named for what it does", () => {
		expect(range.levels?.(settingsOf(settings))).toEqual([
			{
				id: "buy",
				pricedMint: SOL,
				level: 120_000_000n,
				direction: "falls_to",
				hysteresisBps: 50,
				minGapMs: 60_000,
			},
			{
				id: "sell",
				pricedMint: SOL,
				level: 130_000_000n,
				direction: "rises_to",
				hysteresisBps: 50,
				minGapMs: 60_000,
			},
		]);
	});

	it("counts its budget in what it spends, so selling back returns the money", () => {
		expect(range.budgetMint?.(settingsOf(settings))).toBe(USDC);
	});
});

describe("what a range machine does when an edge fires", () => {
	it("buys the low edge, spending dollars", () => {
		expect(range.decide(settingsOf(settings), view({ wokeOn: "buy" }))).toEqual({
			decide: "act",
			action: {
				do: "swap",
				inputMint: USDC,
				outputMint: SOL,
				inputAmount: 5_000_000n,
				slippageBps: 50,
			},
			because: "the price fell to 120000000, the bottom of the band",
		});
	});

	it("sells the high edge, and sells the whole position rather than part of it", () => {
		expect(range.decide(settingsOf(settings), holding({ wokeOn: "sell" }))).toEqual({
			decide: "act",
			action: {
				do: "swap",
				inputMint: SOL,
				outputMint: USDC,
				inputAmount: 41_000_000n,
				slippageBps: 50,
			},
			because: "the price rose to 130000000, the top of the band",
		});
	});

	it("will not buy again while it is already holding, however far the price falls", () => {
		// A range with no limit buys all the way down and ends up holding the whole budget in a
		// falling token. One position at a time is what stops that.
		const decision = range.decide(settingsOf(settings), holding({ wokeOn: "buy" }));

		expect(decision).toMatchObject({ decide: "wait", because: "limit_reached" });
	});

	it("will not sell what it does not hold", () => {
		const decision = range.decide(settingsOf(settings), view({ wokeOn: "sell" }));

		expect(decision).toMatchObject({ decide: "wait", because: "balance_too_low" });
	});

	it("treats dust as holding nothing, so a rounding leftover cannot block the next buy", () => {
		const dusty = view({
			wokeOn: "buy",
			balances: new Map([
				[USDC, baseUnitsOf(50_000_000n)],
				[SOL, baseUnitsOf(999_999n)],
			]),
		});

		expect(range.decide(settingsOf(settings), dusty)).toMatchObject({ decide: "act" });
	});

	it("waits when the run names no edge, rather than guessing from the price", () => {
		// Deciding without knowing which edge fired is how a range machine buys its own sell.
		const decision = range.decide(settingsOf(settings), view());

		expect(decision).toMatchObject({ decide: "wait", because: "not_due" });
	});

	it("waits when the run names an edge it does not have", () => {
		const decision = range.decide(settingsOf(settings), view({ wokeOn: "sideways" }));

		expect(decision).toMatchObject({ decide: "wait", because: "not_due" });
	});

	it("stops buying when the budget will not cover another trade", () => {
		const spent = view({ wokeOn: "buy", availableBudget: baseUnitsOf(4_000_000n) });

		expect(range.decide(settingsOf(settings), spent)).toMatchObject({
			decide: "wait",
			because: "budget_exhausted",
		});
	});

	it("refuses to buy with dollars it does not hold, whatever the budget allows", () => {
		const empty = view({ wokeOn: "buy", balances: new Map([[USDC, baseUnitsOf(1_000_000n)]]) });

		expect(range.decide(settingsOf(settings), empty)).toMatchObject({
			decide: "wait",
			because: "balance_too_low",
		});
	});

	it("sells even when the budget is spent, because selling is how the budget comes back", () => {
		const spent = holding({ wokeOn: "sell", availableBudget: baseUnitsOf(0n) });

		expect(range.decide(settingsOf(settings), spent)).toMatchObject({ decide: "act" });
	});
});

describe("settings a range machine refuses", () => {
	const cases: [string, unknown][] = [
		["nothing at all", null],
		["a number instead of settings", 42],
		["no quote token", { ...settings, quoteMint: undefined }],
		["a quote token that is not an address", { ...settings, quoteMint: "dollars" }],
		["no base token", { ...settings, baseMint: undefined }],
		["a base token that is not an address", { ...settings, baseMint: "sol" }],
		["a bottom edge of nothing", { ...settings, buyLevel: "0" }],
		["a bottom edge that is not a number", { ...settings, buyLevel: "low" }],
		["a top edge of nothing", { ...settings, sellLevel: "0" }],
		["a top edge that is not a number", { ...settings, sellLevel: "high" }],
		["an amount that is not a number", { ...settings, amountPerBuy: "some" }],
		["a negative amount", { ...settings, amountPerBuy: -5n }],
		["a position floor that is not a number", { ...settings, minBase: "dust" }],
		["slippage that is not whole", { ...settings, slippageBps: 12.5 }],
		["slippage beyond everything", { ...settings, slippageBps: 10_001 }],
		["hysteresis that is not whole", { ...settings, hysteresisBps: -1 }],
		["a gap that is not whole", { ...settings, minGapMs: 1.5 }],
	];

	for (const [what, raw] of cases) {
		it(`refuses ${what}`, () => {
			const parsed = read(raw);
			expect(parsed.ok, `${what} was accepted`).toBe(false);
			if (!parsed.ok) expect(parsed.problem.length).toBeGreaterThan(0);
		});
	}

	it("takes the defaults for what an owner leaves out", () => {
		const bare = settingsOf({
			quoteMint: USDC,
			baseMint: SOL,
			buyLevel: "120000000",
			sellLevel: "130000000",
			amountPerBuy: "5000000",
		});

		expect(bare).toMatchObject({
			slippageBps: 50,
			hysteresisBps: 50,
			minGapMs: 60_000,
			minBase: 0n,
		});
	});

	it("takes amounts as bigints as well as digits", () => {
		expect(settingsOf({ ...settings, amountPerBuy: 5_000_000n })).toMatchObject({
			amountPerBuy: 5_000_000n,
		});
	});
});

describe("a band that cannot pay for itself", () => {
	it("is refused, however well the machine would work it", () => {
		// 120 to 120.12 is ten basis points. A round trip costs several times that.
		const tight = read({ ...settings, buyLevel: "120000000", sellLevel: "120120000" });

		expect(tight.ok).toBe(false);
		if (!tight.ok) expect(tight.problem).toMatch(/costs/);
	});

	it("is accepted once it is wider than the cost of trading it", () => {
		expect(read({ ...settings, buyLevel: "120000000", sellLevel: "121000000" }).ok).toBe(true);
	});

	it("takes an owner's wider floor", () => {
		const band = { ...settings, buyLevel: "120000000", sellLevel: "121000000" };

		expect(read(band).ok).toBe(true);
		expect(read({ ...band, minEdgeBps: 200 }).ok).toBe(false);
	});

	it("will not accept an owner's narrower floor, because it does not make trading cheaper", () => {
		const wished = read({
			...settings,
			buyLevel: "120000000",
			sellLevel: "120120000",
			minEdgeBps: 1,
		});

		expect(wished.ok).toBe(false);
	});

	it("refuses a floor that is not a whole number of basis points", () => {
		expect(read({ ...settings, minEdgeBps: 12.5 }).ok).toBe(false);
	});
});
