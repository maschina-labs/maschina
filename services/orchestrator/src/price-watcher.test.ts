import { baseUnitsOf, newId } from "@maschina/core";
import { KNOWN_KINDS, type MachineKind, registryOf } from "@maschina/runtime";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { type PriceWatcherPorts, watchPrices } from "./price-watcher.ts";

const logger = createLogger({ service: "test", level: "silent" });
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const machineId = newId<"machine">();
const waiting = {
	machineId,
	kind: "price_trigger",
	settings: {
		spendMint: USDC,
		buyMint: SOL,
		level: "142000000",
		direction: "falls_to",
		amountPerTrade: "5000000",
		slippageBps: 50,
		hysteresisBps: 50,
		minGapMs: 0,
	},
};

/** Prices in micro-dollars, handed out one tick at a time. */
function ports(
	prices: bigint[],
	machines: PriceWatcherPorts extends never
		? never
		: Awaited<ReturnType<PriceWatcherPorts["watching"]>> = [waiting],
) {
	const queued: { machineId: string; occurrenceKey: string; wokeOn: string }[] = [];
	const asked: string[][] = [];
	let tick = 0;
	const base: PriceWatcherPorts = {
		kinds: KNOWN_KINDS,
		watching: async () => machines,
		pricesFor: async (mints) => {
			asked.push([...mints]);
			const price = prices[Math.min(tick++, prices.length - 1)] ?? 0n;
			return new Map(mints.map((mint) => [mint, price]));
		},
		queue: async (run) => {
			queued.push({
				machineId: run.machineId,
				occurrenceKey: run.occurrenceKey,
				wokeOn: run.wokeOn,
			});
		},
		logger,
		now: () => new Date(2026, 8, 21, 9, tick),
	};
	return { ports: base, queued, asked };
}

/** Runs the watcher for a fixed number of ticks. */
async function ticks(count: number, port: PriceWatcherPorts) {
	const stop = new AbortController();
	let seen = 0;
	await watchPrices(
		{
			...port,
			sleep: async () => {
				seen += 1;
				if (seen >= count) stop.abort();
			},
		},
		stop.signal,
	);
}

describe("watching prices for machines", () => {
	it("queues a run when the price crosses the level, once", async () => {
		const { ports: p, queued } = ports([145_000_000n, 141_000_000n, 141_500_000n]);
		await ticks(3, p);

		expect(queued).toHaveLength(1);
		expect(queued[0]?.machineId).toBe(machineId);
	});

	it("asks only for the tokens a machine is waiting on", async () => {
		const { ports: p, asked } = ports([145_000_000n]);
		await ticks(1, p);

		expect(asked[0]).toEqual([SOL]);
	});

	it("queues nothing when nobody is waiting", async () => {
		const { ports: p, queued, asked } = ports([141_000_000n], []);
		await ticks(2, p);

		expect(queued).toEqual([]);
		expect(asked).toEqual([]);
	});

	it("queues a separate run for each machine waiting on the same level", async () => {
		const second = { ...waiting, machineId: newId<"machine">() };
		const { ports: p, queued } = ports([145_000_000n, 141_000_000n], [waiting, second]);
		await ticks(2, p);

		expect(queued.map((run) => run.machineId).sort()).toEqual([machineId, second.machineId].sort());
		// The same crossing names the same occurrence for both, which is fine: a key is unique per machine,
		// and that is what stops one machine running the same crossing twice.
		for (const run of queued) expect(run.occurrenceKey).toContain("142000000");
	});

	it("keeps going when the price source fails, and says so", async () => {
		const { ports: p, queued } = ports([141_000_000n]);
		let failures = 0;
		const failing: PriceWatcherPorts = {
			...p,
			pricesFor: async (mints) => {
				failures += 1;
				if (failures <= 2) throw new Error("the price source is down");
				return new Map(mints.map((mint) => [mint, 141_000_000n]));
			},
		};
		await ticks(4, failing);

		expect(failures).toBeGreaterThan(2);
		// The machine starts below its level after an outage, so nothing fires: a crossing was not seen.
		expect(queued).toEqual([]);
	});

	it("ignores a machine whose settings make no sense, without stopping", async () => {
		const broken = { ...waiting, machineId: newId<"machine">(), settings: { level: "nope" } };
		const { ports: p, queued } = ports([145_000_000n, 141_000_000n], [broken, waiting]);
		await ticks(2, p);

		expect(queued.map((run) => run.machineId)).toEqual([machineId]);
	});
});

/** A machine kind waiting on two edges at once, which is what a range machine is. */
const twoEdges: MachineKind<{ low: bigint; high: bigint }> = {
	kind: "two_edges",
	readSettings: (settings) => {
		const read = settings as { low?: string; high?: string } | null;
		if (!read?.low || !read.high) return { ok: false, problem: "both edges are needed" };
		return { ok: true, value: { low: BigInt(read.low), high: BigInt(read.high) } };
	},
	decide: () => ({ decide: "wait", because: "not_due" }),
	levels: (settings) => [
		{
			id: "low",
			pricedMint: SOL,
			level: baseUnitsOf(settings.low),
			direction: "falls_to",
			hysteresisBps: 50,
			minGapMs: 0,
		},
		{
			id: "high",
			pricedMint: SOL,
			level: baseUnitsOf(settings.high),
			direction: "rises_to",
			hysteresisBps: 50,
			minGapMs: 0,
		},
	],
};

/** A kind that runs on a schedule, so it is waiting on no price at all. */
const onASchedule: MachineKind<unknown> = {
	kind: "recurring_buy",
	readSettings: () => ({ ok: true, value: {} }),
	decide: () => ({ decide: "wait", because: "not_due" }),
};

describe("a machine waiting on more than one level", () => {
	const ranged = {
		machineId,
		kind: "two_edges",
		settings: { low: "120000000", high: "130000000" },
	};
	const kinds = registryOf([twoEdges, onASchedule] as never);

	it("fires each edge on its own, and names which one woke the machine", async () => {
		// Clear of both edges, then through the low one, then back up and through the high one.
		const { ports: p, queued } = ports(
			[125_000_000n, 119_000_000n, 125_000_000n, 131_000_000n],
			[ranged],
		);
		await ticks(4, { ...p, kinds });

		expect(queued).toHaveLength(2);
		// Named on the run itself, not only in the key, because that is what the machine is told.
		expect(queued.map((run) => run.wokeOn)).toEqual(["low", "high"]);
		expect(queued[0]?.occurrenceKey).toContain("low");
		expect(queued[1]?.occurrenceKey).toContain("high");
	});

	it("does not let one edge's crossing arm the other", async () => {
		// Sitting under the low edge the whole time. The high edge never fires, however long it sits.
		const { ports: p, queued } = ports([119_000_000n, 118_000_000n, 117_000_000n], [ranged]);
		await ticks(3, { ...p, kinds });

		expect(queued.every((run) => run.occurrenceKey.includes("low"))).toBe(true);
	});

	it("asks for each watched token once, however many levels want it", async () => {
		const { ports: p, asked } = ports([125_000_000n], [ranged]);
		await ticks(1, { ...p, kinds });

		expect(asked[0]).toEqual([SOL]);
	});
});

describe("kinds the watcher was not given", () => {
	it("leaves a machine that waits on no price alone", async () => {
		const scheduled = { machineId, kind: "recurring_buy", settings: {} };
		const { ports: p, queued, asked } = ports([119_000_000n], [scheduled]);
		await ticks(2, { ...p, kinds: registryOf([onASchedule] as never) });

		expect(queued).toEqual([]);
		// No level to watch means no price is asked for at all: quota is not spent on nothing.
		expect(asked).toEqual([]);
	});

	it("says so when a machine's kind is one it does not know", async () => {
		const unknown = { machineId, kind: "sniper", settings: {} };
		const { ports: p, queued } = ports([119_000_000n], [unknown]);
		const warn = vi.fn();
		await ticks(1, {
			...p,
			kinds: registryOf([onASchedule] as never),
			logger: { ...p.logger, warn } as unknown as PriceWatcherPorts["logger"],
		});

		expect(queued).toEqual([]);
		expect(warn).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "sniper" }),
			expect.stringContaining("does not know"),
		);
	});
});
