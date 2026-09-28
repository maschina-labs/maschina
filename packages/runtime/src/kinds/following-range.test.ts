import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { MachineView } from "../machine-kind.ts";
import { followingRange, followingState } from "./following-range.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const HOUR = 3_600_000;
const T0 = new Date("2026-09-28T03:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

/** $120.00 as the watcher sees it: micro-dollars per whole SOL. */
const usd = (dollars: number) => BigInt(Math.round(dollars * 1_000_000));

const read = (over: Record<string, unknown> = {}) => {
	const settings = followingRange.readSettings({
		quoteMint: USDC,
		baseMint: SOL,
		bandBps: 200,
		amountPerBuy: "27750000",
		...over,
	});
	if (!settings.ok) throw new Error(settings.problem);
	return settings.value;
};

let seq = 0;
const event = (type: string, payload: object, occurredAt: Date) =>
	({ id: `e${seq++}`, machineId: "m", type, payload, occurredAt }) as never;

const recentred = (price: number, when: Date, because = "started") =>
	event("machine.recentred", { price: usd(price).toString(), because }, when);

/** A trade that completed: spend `input` of one token for `output` of the other. */
const trade = (id: string, from: string, to: string, input: bigint, output: bigint, when: Date) => [
	event(
		"trade.intended",
		{
			runId: "r",
			tradeId: id,
			inputMint: from,
			outputMint: to,
			inputAmount: input.toString(),
			quotedOutputAmount: output.toString(),
		},
		when,
	),
	event(
		"trade.completed",
		{
			runId: "r",
			tradeId: id,
			signature: "5".repeat(88),
			inputAmount: input.toString(),
			outputAmount: output.toString(),
			feeLamports: "5000",
		},
		when,
	),
];
/** Buying 27.75 USDC of SOL at a price. */
const bought = (id: string, price: number, when: Date) => {
	const lamports = BigInt(Math.round((27.75 / price) * 1e9));
	return trade(id, USDC, SOL, 27_750_000n, lamports, when);
};
/** Selling a number of lamports at a price. */
const sold = (id: string, lamports: bigint, price: number, when: Date) =>
	trade(id, SOL, USDC, lamports, BigInt(Math.round((Number(lamports) / 1e9) * price * 1e6)), when);

const levelsAt = (events: never[], now: Date, settings = read()) =>
	followingRange.levels?.(settings, { events, now }) ?? [];
const byId = (levels: ReturnType<typeof levelsAt>) =>
	Object.fromEntries(levels.map((l) => [l.id, l]));

describe("reading a following range's settings", () => {
	it("takes a band, a buy size, and defaults for the floor and the cool-off", () => {
		const settings = read();
		expect(settings.floorBps).toBe(500);
		expect(settings.cooldownMs).toBe(HOUR);
		expect(settings.baseDecimals).toBe(9);
	});

	it("refuses a band too narrow to cover a round trip", () => {
		const narrow = followingRange.readSettings({
			quoteMint: USDC,
			baseMint: SOL,
			bandBps: 40,
			amountPerBuy: "1000000",
		});
		expect(!narrow.ok && narrow.problem).toMatch(/basis points/);
	});

	it.each([
		["a floor of nothing", { floorBps: 0 }],
		["a floor past half the price", { floorBps: 6000 }],
		["a buy of nothing", { amountPerBuy: "0" }],
		["a quote token that is not an address", { quoteMint: "dollars" }],
		["a base token that is not an address", { baseMint: "sol" }],
		["the same token on both sides", { baseMint: USDC }],
		["decimals past eighteen", { baseDecimals: 19 }],
		["decimals that are not whole", { baseDecimals: 1.5 }],
		["no band at all", { bandBps: undefined }],
		["a band wider than half the price", { bandBps: 6000 }],
		["a buy that is not an amount", { amountPerBuy: 5 }],
		["a buy below zero", { amountPerBuy: -5n }],
		["a cool-off that is not whole", { cooldownMs: 1.5 }],
		["dust that is not an amount", { minBase: "dust" }],
		["slippage past everything", { slippageBps: 10_001 }],
		["a hysteresis below zero", { hysteresisBps: -1 }],
		["a gap that is not whole", { minGapMs: "soon" }],
	])("refuses %s", (_what, over) => {
		const settings = followingRange.readSettings({
			quoteMint: USDC,
			baseMint: SOL,
			bandBps: 200,
			amountPerBuy: "1000000",
			...over,
		});
		expect(settings.ok).toBe(false);
	});

	it("refuses settings that are not settings", () => {
		expect(followingRange.readSettings(null).ok).toBe(false);
	});

	it("takes amounts written as whole numbers of the token's smallest unit", () => {
		expect(read({ amountPerBuy: 27_750_000n, minBase: "1000" }).minBase).toBe(1000n);
	});

	it("counts its budget in what it spends", () => {
		expect(followingRange.budgetMint?.(read())).toBe(USDC);
	});

	it("waits on nothing when it is not given its record", () => {
		expect(followingRange.levels?.(read())).toEqual([]);
	});

	it("accepts a floor of three percent for an owner who wants it tighter", () => {
		expect(read({ floorBps: 300 }).floorBps).toBe(300);
	});
});

describe("before it has a price to work around", () => {
	it("asks for one, and watches nothing until it has it", () => {
		const settings = read();
		expect(followingRange.needsAnchor?.(settings, { events: [], now: T0 })).toEqual({
			pricedMint: SOL,
			because: "started",
		});
		expect(levelsAt([], T0)).toEqual([]);
	});
});

describe("holding what it spends", () => {
	const started = [recentred(120, T0)];

	it("buys a dip of half the band below the anchor", () => {
		expect(byId(levelsAt(started, T0))["buy"]).toMatchObject({
			level: usd(118.8),
			direction: "falls_to",
		});
	});

	it("follows a rise of half the band above the anchor, rather than waiting for a dip that left", () => {
		const follow = byId(levelsAt(started, T0))["follow"];
		expect(follow).toMatchObject({ level: usd(121.2), direction: "rises_to", recentres: true });
	});

	it("moves its whole band up once it has followed", () => {
		const followed = [...started, recentred(121.2, at(30), "followed")];
		expect(byId(levelsAt(followed, at(30)))["buy"]?.level).toBe(usd(119.988));
	});

	it("needs nothing once it has a price", () => {
		expect(followingRange.needsAnchor?.(read(), { events: started, now: T0 })).toBeUndefined();
	});
});

describe("holding what it bought", () => {
	const events = [recentred(120, T0), ...bought("t1", 118.8, at(10))];

	it("sells a full band above what it paid", () => {
		const sell = byId(levelsAt(events, at(11)))["sell"];
		expect(Number(sell?.level)).toBeCloseTo(Number(usd(121.176)), -3);
		expect(sell?.direction).toBe("rises_to");
	});

	it("sells at the floor if the price falls five percent below what it paid", () => {
		const floor = byId(levelsAt(events, at(11)))["floor"];
		expect(Number(floor?.level)).toBeCloseTo(Number(usd(112.86)), -3);
		expect(floor?.direction).toBe("falls_to");
	});

	it("never moves its band while holding, so it never locks in a loss above the floor", () => {
		const ids = levelsAt(events, at(11))
			.map((l) => l.id)
			.sort();
		expect(ids).toEqual(["floor", "sell"]);
	});

	it("uses a tighter floor when the owner chose three percent", () => {
		const floor = byId(levelsAt(events, at(11), read({ floorBps: 300 })))["floor"];
		expect(Number(floor?.level)).toBeCloseTo(Number(usd(115.236)), -3);
	});
});

describe("after a sale", () => {
	it("re-centres on the price it sold at and waits for the next dip", () => {
		const events = [recentred(120, T0), ...bought("t1", 118.8, at(10))];
		const lamports = followingState(events, read()).position;
		const after = [...events, ...sold("t2", lamports, 121.2, at(40))];

		// The sale price comes from whole lamports, so it can land a micro-dollar under.
		expect(Number(byId(levelsAt(after, at(41)))["buy"]?.level)).toBeCloseTo(
			Number(usd(119.988)),
			-3,
		);
	});
});

describe("working out where it stands", () => {
	it("counts a paper trade the same as a real one", () => {
		const paper = [
			event(
				"trade.intended",
				{ runId: "r", tradeId: "p1", inputMint: USDC, outputMint: SOL, inputAmount: "27750000" },
				T0,
			),
			event(
				"trade.simulated",
				{ runId: "r", tradeId: "p1", inputAmount: "27750000", quotedOutputAmount: "230000000" },
				T0,
			),
		];
		expect(followingState(paper, read())).toMatchObject({
			position: 230_000_000n,
			basis: 27_750_000n,
		});
	});

	it("counts a trade once, however many times it is reported, and only trades it made", () => {
		const once = bought("t1", 120, T0);
		const stranger = trade("t2", USDC, "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", 1n, 1n, T0);
		const orphan = event(
			"trade.completed",
			{ runId: "r", tradeId: "t3", inputAmount: "1", outputAmount: "1", feeLamports: "0" },
			T0,
		);
		const events = [...once, ...once, ...stranger, orphan, event("run.started", {}, T0)];
		expect(followingState(events, read()).position).toBe(followingState(once, read()).position);
	});
});

describe("after the floor", () => {
	const buy = [recentred(120, T0), ...bought("t1", 118.8, at(10))];
	const position = () => followingState(buy, read()).position;
	const floored = () => [...buy, ...sold("t2", position(), 112.8, at(60))];

	it("rests for an hour, watching nothing, rather than buying straight back into a fall", () => {
		expect(levelsAt(floored(), at(90))).toEqual([]);
		expect(
			followingRange.needsAnchor?.(read(), { events: floored(), now: at(90) }),
		).toBeUndefined();
	});

	it("asks for a fresh price once the hour is up, and carries on from there", () => {
		expect(followingRange.needsAnchor?.(read(), { events: floored(), now: at(121) })).toEqual({
			pricedMint: SOL,
			because: "after_floor",
		});
		const resumed = [...floored(), recentred(110, at(121), "after_floor")];
		expect(byId(levelsAt(resumed, at(122)))["buy"]?.level).toBe(usd(108.9));
	});
});

describe("deciding, once a level has woken it", () => {
	const view = (over: Partial<MachineView> = {}): MachineView => ({
		balances: new Map([[USDC, baseUnitsOf(28_000_000n)]]),
		position: new Map(),
		availableBudget: baseUnitsOf(28_000_000n),
		now: T0,
		totals: { spent: baseUnitsOf(0n), buys: 0 },
		...over,
	});
	const holding = (lamports: bigint) =>
		view({
			balances: new Map([
				[SOL, baseUnitsOf(lamports)],
				[USDC, baseUnitsOf(0n)],
			]),
			position: new Map([[SOL, baseUnitsOf(lamports)]]),
		});

	it("buys at the bottom of the band", () => {
		const decision = followingRange.decide(read(), view({ wokeOn: "buy" }));
		expect(decision).toMatchObject({
			decide: "act",
			action: { inputMint: USDC, inputAmount: 27_750_000n },
		});
	});

	it("does not buy twice", () => {
		expect(
			followingRange.decide(read(), { ...holding(230_000_000n), wokeOn: "buy" }),
		).toMatchObject({
			decide: "wait",
			because: "limit_reached",
		});
	});

	it.each(["sell", "floor"])("sells everything it holds when woken by the %s", (level) => {
		const decision = followingRange.decide(read(), { ...holding(230_000_000n), wokeOn: level });
		expect(decision).toMatchObject({
			decide: "act",
			action: { inputMint: SOL, outputMint: USDC, inputAmount: 230_000_000n },
		});
	});

	it("says why when the floor sells", () => {
		const decision = followingRange.decide(read(), { ...holding(230_000_000n), wokeOn: "floor" });
		expect(decision.decide === "act" && decision.because).toMatch(/floor/);
	});

	it("does nothing on a sell or floor it is not holding anything for", () => {
		expect(followingRange.decide(read(), view({ wokeOn: "sell" }))).toMatchObject({
			decide: "wait",
		});
	});

	it("does not count SOL kept for fees as a position, because it never bought it", () => {
		const funded = view({
			wokeOn: "buy",
			balances: new Map([
				[USDC, baseUnitsOf(28_000_000n)],
				[SOL, baseUnitsOf(10_900_000n)],
			]),
		});
		expect(followingRange.decide(read(), funded)).toMatchObject({
			decide: "act",
			action: { inputMint: USDC, inputAmount: 27_750_000n },
		});
	});

	it("sells what it bought and leaves the SOL kept for fees", () => {
		const withFees = view({
			wokeOn: "sell",
			balances: new Map([[SOL, baseUnitsOf(240_900_000n)]]),
			position: new Map([[SOL, baseUnitsOf(230_000_000n)]]),
		});
		expect(followingRange.decide(read(), withFees)).toMatchObject({
			decide: "act",
			action: { inputMint: SOL, inputAmount: 230_000_000n },
		});
	});

	it("never sells more than the wallet actually holds", () => {
		const short = view({
			wokeOn: "sell",
			balances: new Map([[SOL, baseUnitsOf(229_000_000n)]]),
			position: new Map([[SOL, baseUnitsOf(230_000_000n)]]),
		});
		expect(followingRange.decide(read(), short)).toMatchObject({
			decide: "act",
			action: { inputAmount: 229_000_000n },
		});
	});

	it("waits for the money when the wallet cannot cover a buy", () => {
		const empty = view({ wokeOn: "buy", balances: new Map([[USDC, baseUnitsOf(1_000_000n)]]) });
		expect(followingRange.decide(read(), empty)).toMatchObject({
			decide: "wait",
			because: "balance_too_low",
		});
	});

	it("does nothing on a level it does not act on, or with no level at all", () => {
		expect(followingRange.decide(read(), view({ wokeOn: "follow" }))).toMatchObject({
			decide: "wait",
			because: "not_due",
		});
		expect(followingRange.decide(read(), view())).toMatchObject({
			decide: "wait",
			because: "not_due",
		});
	});

	it("refuses a buy the budget cannot cover", () => {
		const decision = followingRange.decide(
			read(),
			view({ wokeOn: "buy", availableBudget: baseUnitsOf(1n) }),
		);
		expect(decision).toMatchObject({ decide: "wait", because: "budget_exhausted" });
	});
});
