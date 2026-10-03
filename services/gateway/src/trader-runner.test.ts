import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The database, the market and the engine's tick are stood in for: this proves the runner's own work,
// which is choosing runs, keeping one tick per run, saving after each, and never undoing a stop.
const db = vi.hoisted(() => ({
	runs: [] as { id: string; ownerId: string; status: string; state: unknown }[],
	saved: [] as { id: string; status: string }[],
	secret: undefined as { sealed: string } | undefined,
}));

vi.mock("@maschina/db", () => ({
	latestTraderRun: vi.fn(async (_db: unknown, ownerId: string) =>
		db.runs.filter((run) => run.ownerId === ownerId).at(-1),
	),
	runningTraderRuns: vi.fn(async () => db.runs.filter((run) => run.status === "running")),
	saveTraderRun: vi.fn(
		async (_db: unknown, run: { id: string; ownerId: string; status: string; state: unknown }) => {
			db.saved.push({ id: run.id, status: run.status });
			const known = db.runs.find((each) => each.id === run.id);
			if (known) Object.assign(known, run);
			else db.runs.push({ ...run });
		},
	),
	readOwnerSecret: vi.fn(async () => db.secret),
}));

const solana = vi.hoisted(() => ({
	quote: vi.fn(async () => ({ outputAmount: 123n, priceImpactBps: 40 })),
	jupiter: vi.fn(async () => new Map([["J", { micros: 2_500_000n }]])),
	dex: vi.fn(
		async (mints: string[]) =>
			new Map(mints.filter((mint) => mint !== "J").map((mint) => [mint, 1.5])),
	),
	market: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@maschina/solana", () => ({
	parseAddress: (value: string) => value,
	jupiterRouter: () => ({ quote: solana.quote }),
	jupiterPrices: () => ({ usdPrices: solana.jupiter }),
	dexScreenerPrices: () => solana.dex,
	jupiterMarket: () => solana.market,
}));

const engine = vi.hoisted(() => ({
	tick: vi.fn(async (state: { status: string }): Promise<{ status: string }> => ({ ...state })),
}));

vi.mock("@maschina/manager", async (original) => ({
	...(await original<typeof import("@maschina/manager")>()),
	tick: engine.tick,
}));

const { traderRunner } = await import("./trader-runner.ts");

const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
const make = () =>
	traderRunner({
		db: {} as never,
		sealing: undefined,
		logger: logger as never,
		now: () => new Date("2026-10-03T12:00:00Z"),
	});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	db.runs = [];
	db.saved = [];
	db.secret = undefined;
	vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("the paper trader runner", () => {
	it("begins a run with the cash given, saves it, and ticks it straight away", async () => {
		const runner = make();
		const begun = await runner.begin("owner", 40_000_000n);
		expect(begun.state.book.cash).toBe(40_000_000n);
		await settle();
		expect(engine.tick).toHaveBeenCalledOnce();
		expect(db.saved.map((each) => each.status)).toEqual(["running", "running"]);
	});

	it("hands back the run already going rather than starting a second", async () => {
		const runner = make();
		const first = await runner.begin("owner", 40_000_000n);
		const again = await runner.begin("owner", 99_000_000n);
		expect(again.id).toBe(first.id);
	});

	it("stops a run, and a tick in flight cannot bring it back", async () => {
		const runner = make();
		let release: () => void = () => undefined;
		engine.tick.mockImplementationOnce(
			(state) =>
				new Promise((resolve) => (release = () => resolve({ ...state, status: "running" }))),
		);
		const begun = await runner.begin("owner", 40_000_000n);
		const stopped = await runner.end("owner");
		expect(stopped?.state.status).toBe("stopped");
		release();
		await settle();
		expect(db.runs.find((run) => run.id === begun.id)?.status).toBe("stopped");
		// Stopping what is already stopped changes nothing.
		expect((await runner.end("owner"))?.state.status).toBe("stopped");
		expect(await runner.end("nobody")).toBeUndefined();
	});

	it("shows the newest run, or none", async () => {
		const runner = make();
		expect(await runner.latest("owner")).toBeUndefined();
		await runner.begin("owner", 40_000_000n);
		expect((await runner.latest("owner"))?.state.status).toBe("running");
	});

	it("ticks every running run on a timer, and logs a tick that fails rather than stopping", async () => {
		vi.useFakeTimers();
		db.runs.push({ id: "r1", ownerId: "owner", status: "running", state: { status: "running" } });
		db.runs.push({ id: "r2", ownerId: "other", status: "stopped", state: { status: "stopped" } });
		engine.tick.mockRejectedValueOnce(new Error("boom"));
		const runner = make();
		runner.start();
		await vi.advanceTimersByTimeAsync(5_000);
		runner.stop();
		expect(
			engine.tick.mock.calls.every(([state]) => (state as { status: string }).status === "running"),
		).toBe(true);
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({ run: "r1" }),
			"trader tick failed",
		);
	});
});

describe("the prices, quotes and tokens a run trades on", () => {
	it("prices from DexScreener first and asks Jupiter only for what it missed", async () => {
		const ports = await make().portsFor("owner");
		const prices = await ports.prices(["A", "J"]);
		expect(prices).toEqual(
			new Map([
				["A", 1.5],
				["J", 2.5],
			]),
		);
		expect(solana.jupiter).toHaveBeenCalledWith(["J"]);
	});

	it("falls back to Jupiter whole when DexScreener is down", async () => {
		solana.dex.mockRejectedValueOnce(new Error("429"));
		const ports = await make().portsFor("owner");
		expect((await ports.prices(["J"])).get("J")).toBe(2.5);
	});

	it("quotes in the engine's terms", async () => {
		const ports = await make().portsFor("owner");
		expect(await ports.quote({ inputMint: "A", outputMint: "B", amount: 5n })).toEqual({
			outAmount: 123n,
			impactPct: 0.4,
		});
	});

	it("looks a token up once, and says nothing for one it cannot find", async () => {
		const fetch = vi.fn(
			async () => new Response(JSON.stringify([{ id: "M", symbol: "MEME", decimals: 6 }])),
		);
		vi.stubGlobal("fetch", fetch);
		const ports = await make().portsFor("owner");
		expect(await ports.token("M")).toEqual({ symbol: "MEME", decimals: 6 });
		expect(await ports.token("M")).toEqual({ symbol: "MEME", decimals: 6 });
		expect(fetch).toHaveBeenCalledOnce();
		expect(await ports.token("missing")).toBeUndefined();
		fetch.mockResolvedValueOnce(new Response("busy", { status: 429 }));
		expect(await ports.token("other")).toBeUndefined();
		vi.unstubAllGlobals();
	});

	it("cannot think without a key, and says so", async () => {
		const ports = await make().portsFor("owner");
		await expect(ports.claude({} as never)).rejects.toThrow("no Anthropic key");
	});

	it("scans the market as the manager reads it", async () => {
		solana.market.mockResolvedValueOnce([]);
		const ports = await make().portsFor("owner");
		expect(await ports.scan({ interval: "5m", limit: 10 })).toEqual([]);
	});
});
