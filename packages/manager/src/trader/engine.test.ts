import { describe, expect, it, vi } from "vitest";
import type { Claude, ClaudeReply } from "../claude.ts";
import {
	briefing,
	type EnginePorts,
	NETWORK_FEE,
	newTrader,
	type TraderState,
	tick,
	USDC_MINT,
	valueAt,
} from "./engine.ts";
import { liveliness, shortlist, sweep, type UniverseToken } from "./universe.ts";

const WIF = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const usage = { inputTokens: 10_000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 };
const say = (text: string): ClaudeReply => ({
	content: [{ type: "text", text }],
	stopReason: "end_turn",
	usage,
});
const use = (name: string, input: Record<string, unknown>, id = name): ClaudeReply => ({
	content: [{ type: "tool_use", id, name, input }],
	stopReason: "tool_use",
	usage,
});

const token = (over: Partial<UniverseToken> = {}): UniverseToken => ({
	mint: WIF,
	symbol: "WIF",
	decimals: 6,
	priceUsd: 2,
	liquidityUsd: 1_000_000,
	marketCapUsd: 2e9,
	holders: 200_000,
	ageHours: 9000,
	organic: 90,
	canMintMore: false,
	canFreeze: false,
	topHoldersPct: 20,
	change5mPct: 1,
	change1hPct: 3,
	volume5mUsd: 100_000,
	volume1hUsd: 900_000,
	buysSells5m: "300/250",
	...over,
});

function ports(over: { price?: number; replies?: ClaudeReply[]; impactPct?: number } = {}) {
	let clock = new Date("2026-10-03T12:00:00Z");
	const price = { usd: over.price ?? 2 };
	const replies = [...(over.replies ?? [say("Nothing worth doing.")])];
	const claude = vi.fn<Claude>(async () => replies.shift() ?? say("done"));
	const port: EnginePorts = {
		now: () => clock,
		claude,
		// A buy gets tokens at the price; a sale gets dollars at the price. Both lose half a percent to the pool.
		quote: vi.fn(async ({ inputMint, amount }) => {
			const outAmount =
				inputMint === USDC_MINT
					? BigInt(Math.floor((Number(amount) / price.usd) * 0.995))
					: BigInt(Math.floor(Number(amount) * price.usd * 0.995));
			return { outAmount, impactPct: over.impactPct ?? 0.2 };
		}),
		prices: vi.fn(async (mints: string[]) => new Map(mints.map((mint) => [mint, price.usd]))),
		scan: vi.fn(async () => [token()]),
		token: vi.fn(async () => ({ symbol: "WIF", decimals: 6 })),
	};
	return { port, claude, price, later: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

const fresh = () =>
	newTrader({ id: "t1", cash: 40_000_000n, now: new Date("2026-10-03T12:00:00Z") });

async function holdingWif(state: TraderState) {
	const setup = ports({
		replies: [use("buy", { mint: WIF, usd: 10, reason: "volume rising" }), say("Bought WIF.")],
	});
	const after = await tick(state, setup.port);
	return { after, setup };
}

describe("a new paper trader", () => {
	it("starts running with only cash, default limits, and a dollar a day to think with", () => {
		const trader = fresh();
		expect(trader).toMatchObject({ status: "running", mode: "paper", values: {}, log: [] });
		expect(trader.book.cash).toBe(40_000_000n);
		expect(trader.think).toMatchObject({ everyMs: 300_000, dailyCapUsd: 1, spentUsd: 0 });
		expect(trader.limits.maxPerTrade).toBe(10_000_000n);
	});
});

describe("a tick", () => {
	it("thinks on the first tick, and a buy the AI makes lands in the book at the quote", async () => {
		const { after, setup } = await holdingWif(fresh());
		expect(setup.claude).toHaveBeenCalledTimes(2);
		expect(after.book.holdings).toHaveLength(1);
		expect(after.book.holdings[0]).toMatchObject({ symbol: "WIF", amount: 4_975_000n });
		expect(after.book.cash).toBe(40_000_000n - 10_000_000n - NETWORK_FEE);
		expect(after.log.map((entry) => entry.kind)).toEqual(["buy", "think"]);
		expect(after.log.at(-1)).toMatchObject({ text: "Bought WIF." });
		expect(after.think.turns).toBe(1);
		expect(after.think.spentUsd).toBeGreaterThan(0);
	});

	it("does not think again until it is time, or something moves", async () => {
		const { after, setup } = await holdingWif(fresh());
		setup.later(60_000);
		await tick(after, setup.port);
		expect(setup.claude).toHaveBeenCalledTimes(2);
		// The price jumps 10%, past the 8% that wakes it.
		setup.price.usd = 2.2;
		await tick(after, setup.port);
		expect(setup.claude).toHaveBeenCalledTimes(3);
	});

	it("sells a holding down past its stop without asking the AI", async () => {
		const { after, setup } = await holdingWif(fresh());
		setup.price.usd = 1.6;
		setup.later(10_000);
		const stopped = await tick(
			{ ...after, think: { ...after.think, spentTodayUsd: 99 } },
			setup.port,
		);
		expect(stopped.book.holdings).toEqual([]);
		expect(stopped.log.find((entry) => entry.kind === "stop")?.text).toMatch(
			/^Sold WIF for \$7\.\d\d \(-\$2\.\d\d\)/,
		);
		expect(stopped.book.realized).toBeLessThan(0n);
		// Past its spending cap it still guards the money, it just does not think.
		expect(setup.claude).toHaveBeenCalledTimes(2);
	});

	it("pauses the whole trader past the drawdown, and does nothing after", async () => {
		const { after, setup } = await holdingWif({
			...fresh(),
			limits: { ...fresh().limits, drawdownPausePct: 5 },
		});
		// Price falls 10%: not past the 15% stop, but the book is down past 5%? It holds a quarter: no.
		// So the stop is tightened out of the way and the drawdown made reachable instead.
		setup.price.usd = 1.4;
		const paused = await tick(
			{
				...after,
				limits: { ...after.limits, stopLossPct: 99 },
				think: { ...after.think, spentTodayUsd: 99 },
			},
			setup.port,
		);
		expect(paused.status).toBe("paused");
		expect(paused.pausedBecause).toContain("down 5%");
		expect(await tick(paused, setup.port)).toBe(paused);
	});

	it("refuses a buy past a limit and tells the AI why", async () => {
		const setup = ports({
			replies: [use("buy", { mint: WIF, usd: 25, reason: "all in" }), say("Refused, so nothing.")],
		});
		const after = await tick(fresh(), setup.port);
		expect(after.book.holdings).toEqual([]);
		expect(after.log.map((entry) => entry.kind)).toEqual(["refused", "think"]);
		const toldAi = setup.claude.mock.calls[1]?.[0].messages.at(-1)?.content as {
			content: string;
			is_error?: boolean;
		}[];
		expect(toldAi[0]).toMatchObject({ is_error: true });
		expect(toldAi[0]?.content).toContain("over the $10.00 limit per trade");
	});

	it("refuses a buy that would move the price too far", async () => {
		const setup = ports({
			impactPct: 7,
			replies: [use("buy", { mint: WIF, usd: 5, reason: "thin" }), say("No.")],
		});
		const after = await tick(fresh(), setup.port);
		expect(after.log[0]?.text).toContain("would move the price 7%");
	});

	it("records a failed thought and does not retry it every tick", async () => {
		const setup = ports();
		setup.claude.mockRejectedValueOnce(new Error("Your Anthropic credit has run out"));
		const after = await tick(fresh(), setup.port);
		expect(after.log.at(-1)).toMatchObject({
			kind: "error",
			text: "Could not think: Your Anthropic credit has run out",
		});
		expect(after.think.lastAt).toBeDefined();
		await tick(after, setup.port);
		expect(setup.claude).toHaveBeenCalledTimes(1);
	});

	it("starts a new day's thinking budget at midnight", async () => {
		const setup = ports();
		const spent = { ...fresh(), think: { ...fresh().think, spentTodayUsd: 5 } };
		setup.later(24 * 3_600_000);
		await tick(spent, setup.port);
		expect(setup.claude).toHaveBeenCalledTimes(1);
	});
});

describe("the AI's other tools", () => {
	it("sells part of a holding, and reads the book", async () => {
		const { after } = await holdingWif(fresh());
		const setup = ports({
			replies: [
				use("sell", { mint: WIF, percent: 50, reason: "half off the table" }, "s"),
				use("book", {}, "b"),
				say("Took half."),
			],
		});
		setup.later(400_000);
		const next = await tick(after, setup.port);
		expect(next.book.holdings[0]?.amount).toBe(2_487_500n);
		const bookAnswer = setup.claude.mock.calls[2]?.[0].messages.at(-1)?.content as {
			content: string;
		}[];
		expect(JSON.parse(bookAnswer[0]?.content ?? "{}")).toMatchObject({
			holdings: [{ symbol: "WIF" }],
		});
	});

	it("sweeps the market once a minute and shows it ranked a page at a time", async () => {
		const setup = ports({
			replies: [
				use("scan_market", { count: 5 }, "a"),
				use("scan_market", { count: 5, skip: 5 }, "b"),
				say("Looked."),
			],
		});
		await tick(fresh(), setup.port);
		// Four windows, swept once: the second look reused the sweep.
		expect(setup.port.scan).toHaveBeenCalledTimes(4);
		const first = setup.claude.mock.calls[1]?.[0].messages.at(-1)?.content as { content: string }[];
		expect(JSON.parse(first[0]?.content ?? "{}")).toMatchObject({
			universe: 1,
			showing: 1,
			tokens: [{ symbol: "WIF" }],
		});
	});

	it("quotes without buying", async () => {
		const setup = ports({ replies: [use("quote", { mint: WIF, usd: 5 }), say("Quoted.")] });
		const after = await tick(fresh(), setup.port);
		expect(after.book.holdings).toEqual([]);
		const quoted = setup.claude.mock.calls[1]?.[0].messages.at(-1)?.content as {
			content: string;
		}[];
		expect(JSON.parse(quoted[0]?.content ?? "{}")).toEqual({
			tokensOut: "2487500",
			priceImpactPct: 0.2,
		});
	});
});

describe("what the AI is told", () => {
	it("gives it the book, the total, the limits and what thinking has cost", async () => {
		const { after } = await holdingWif(fresh());
		const told = briefing(
			{ ...after, values: { [WIF]: "11000000" } },
			new Date("2026-10-03T12:10:00Z"),
		);
		expect(told).toContain("Cash: $29.99");
		expect(told).toContain("WIF");
		expect(told).toContain("+9.9% since bought");
		expect(told).toContain("at most $10.00 per buy");
		expect(told).toContain("of a $1.00 cap");
	});

	it("values a holding at a price per whole token", () => {
		expect(
			valueAt(
				{
					mint: WIF,
					symbol: "WIF",
					decimals: 6,
					amount: 5_000_000n,
					cost: 0n,
					openedAt: new Date(),
				},
				2,
			),
		).toBe(10_000_000n);
	});
});

describe("the universe", () => {
	it("merges every window into one list, freshest sighting kept", async () => {
		const scan = vi.fn(async ({ interval }: { interval: string }) =>
			interval === "5m"
				? [token({ change5mPct: 9 })]
				: [token({ change5mPct: 1 }), token({ mint: "other", symbol: "OTH" })],
		);
		const all = await sweep(scan);
		expect(all.map((each) => each.symbol)).toEqual(["WIF", "OTH"]);
		expect(all[0]?.change5mPct).toBe(9);
	});

	it("fails only when no window can be read", async () => {
		await expect(sweep(async () => Promise.reject(new Error("down")))).rejects.toThrow(
			"could not be read",
		);
	});

	it("ranks by money moving against pool depth, rising beats falling, and drops pools too thin to leave", () => {
		const busy = token({ mint: "busy", liquidityUsd: 100_000, volume5mUsd: 50_000 });
		const falling = token({
			mint: "falling",
			liquidityUsd: 100_000,
			volume5mUsd: 50_000,
			change5mPct: -20,
		});
		const thin = token({ mint: "thin", liquidityUsd: 5_000, volume5mUsd: 50_000 });
		const quiet = token({ mint: "quiet", volume5mUsd: 1_000 });
		expect(shortlist([quiet, falling, thin, busy], 10).map((each) => each.mint)).toEqual([
			"busy",
			"falling",
			"quiet",
		]);
		expect(liveliness(thin)).toBe(0);
		expect(liveliness(token({ liquidityUsd: null }))).toBe(0);
	});
});
