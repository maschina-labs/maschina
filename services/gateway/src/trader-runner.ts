/**
 * Where paper AI traders run: a loop in the gateway that ticks every running run on real prices.
 *
 * Paper needs no wallet and no signature, only quotes and prices, so it can live beside the manager's
 * chat, on the same key. Each run is ticked in turn, never two ticks of one run at once, and saved after
 * every tick, so a restart carries on where it was. A run whose owner has removed their key keeps
 * guarding its book; it just cannot think.
 *
 * Live runs will not run here. They trade through the orchestrator and the signer like every machine.
 */

import { openSecret, type SealingKey } from "@maschina/auth/sealed";
import { baseUnitsOf, newId } from "@maschina/core";
import {
	type Database,
	latestTraderRun,
	readOwnerSecret,
	runningTraderRuns,
	saveTraderRun,
} from "@maschina/db";
import {
	type Claude,
	claude,
	type EnginePorts,
	newTrader,
	type TraderState,
	tick,
} from "@maschina/manager";
import { jupiterMarket, jupiterPrices, jupiterRouter, parseAddress } from "@maschina/solana";
import type { Logger } from "@maschina/telemetry";
import { compactToken } from "./manager-brain.ts";

const TICK_MS = 15_000;

export type TraderRunner = ReturnType<typeof traderRunner>;

export function traderRunner(options: {
	db: Database;
	sealing: SealingKey | undefined;
	logger: Logger;
	now?: () => Date;
}) {
	const now = options.now ?? (() => new Date());
	const router = jupiterRouter();
	const prices = jupiterPrices();
	const market = jupiterMarket();
	const symbols = new Map<string, { symbol: string; decimals: number }>();
	const busy = new Set<string>();
	// Runs stopped while a tick was in flight: that tick's save must not bring them back to life.
	const ended = new Set<string>();

	const keyFor = async (ownerId: string): Promise<string | undefined> => {
		if (!options.sealing) return undefined;
		const stored = await readOwnerSecret(options.db, ownerId, "anthropic");
		return stored ? openSecret(options.sealing, stored.sealed) : undefined;
	};

	const noKey: Claude = async () => {
		throw new Error("there is no Anthropic key in settings");
	};

	const portsFor = (key: string | undefined): EnginePorts => ({
		now,
		claude: key ? claude(key) : noKey,
		quote: async (request) => {
			const quoted = await router.quote({
				inputMint: parseAddress(request.inputMint),
				outputMint: parseAddress(request.outputMint),
				amount: baseUnitsOf(request.amount),
				slippageBps: 100,
			});
			return { outAmount: quoted.outputAmount, impactPct: quoted.priceImpactBps / 100 };
		},
		prices: async (mints) => {
			const found = await prices.usdPrices(mints.map(parseAddress));
			return new Map([...found].map(([mint, price]) => [mint, Number(price.micros) / 1_000_000]));
		},
		scan: async (request) => (await market(request)).map(compactToken),
		token: async (mint) => {
			const cached = symbols.get(mint);
			if (cached) return cached;
			const response = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`, {
				signal: AbortSignal.timeout(8_000),
			});
			if (!response.ok) return undefined;
			const found = (
				(await response.json()) as { id?: string; symbol?: string; decimals?: number }[]
			).find((each) => each.id === mint);
			if (!found || typeof found.decimals !== "number") return undefined;
			const known = { symbol: found.symbol ?? "?", decimals: found.decimals };
			symbols.set(mint, known);
			return known;
		},
	});

	const step = async (id: string, ownerId: string, state: TraderState) => {
		if (busy.has(id)) return;
		busy.add(id);
		try {
			const next = await tick(state, portsFor(await keyFor(ownerId)));
			if (ended.has(id)) return;
			await saveTraderRun(options.db, { id, ownerId, status: next.status, state: next });
		} catch (error) {
			options.logger.error({ err: error, run: id }, "trader tick failed");
		} finally {
			busy.delete(id);
		}
	};

	let timer: ReturnType<typeof setInterval> | undefined;

	return {
		/** The real prices, quotes and key one owner's run would tick with. */
		portsFor: async (ownerId: string) => portsFor(await keyFor(ownerId)),
		/** Ticks every running run, every few seconds, until stopped. */
		start() {
			const round = async () => {
				try {
					for (const run of await runningTraderRuns(options.db))
						void step(run.id, run.ownerId, run.state as TraderState);
				} catch (error) {
					options.logger.error({ err: error }, "trader runs could not be read");
				}
			};
			timer = setInterval(() => void round(), TICK_MS);
			void round();
		},
		stop() {
			if (timer) clearInterval(timer);
		},
		latest: async (ownerId: string) => {
			const run = await latestTraderRun(options.db, ownerId);
			return run ? { id: run.id, state: run.state as TraderState } : undefined;
		},
		/** A new paper run with this much cash. Only one runs at a time per owner. */
		begin: async (ownerId: string, cash: bigint) => {
			const running = await latestTraderRun(options.db, ownerId);
			if (running && running.status === "running")
				return { id: running.id, state: running.state as TraderState };
			const id = newId<"run">();
			const state = newTrader({ id, cash, now: now() });
			await saveTraderRun(options.db, { id, ownerId, status: state.status, state });
			void step(id, ownerId, state);
			return { id, state };
		},
		end: async (ownerId: string) => {
			const run = await latestTraderRun(options.db, ownerId);
			if (!run || run.status === "stopped")
				return run ? { id: run.id, state: run.state as TraderState } : undefined;
			ended.add(run.id);
			const state = { ...(run.state as TraderState), status: "stopped" as const };
			await saveTraderRun(options.db, { id: run.id, ownerId, status: "stopped", state });
			return { id: run.id, state };
		},
	};
}
