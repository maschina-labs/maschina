import { newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
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
	const queued: { machineId: string; occurrenceKey: string }[] = [];
	const asked: string[][] = [];
	let tick = 0;
	const base: PriceWatcherPorts = {
		watching: async () => machines,
		pricesFor: async (mints) => {
			asked.push([...mints]);
			const price = prices[Math.min(tick++, prices.length - 1)] ?? 0n;
			return new Map(mints.map((mint) => [mint, price]));
		},
		queue: async (run) => {
			queued.push({ machineId: run.machineId, occurrenceKey: run.occurrenceKey });
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
