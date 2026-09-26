/**
 * Following prices for the machines waiting on them.
 *
 * Machines that trade on a level cannot watch prices themselves: they only wake when they have a run.
 * So the orchestrator watches, and turns a crossing into a queued run. Deciding whether a crossing
 * counts is not done here (see `observePrice` in the runtime), because that decision has nothing to do
 * with the network and is better tested without it.
 *
 * Which prices to watch is the kind's answer, not this module's. A machine may be waiting on several
 * levels at once, and each one arms and fires on its own: a range machine that has just bought its low
 * edge is still waiting on its high edge, and one crossing must never arm the other.
 *
 * Two things this must never do: queue a run for a crossing that did not happen, and stop watching
 * because a price source had a bad minute. An outage is reported and the loop carries on.
 */

import { MaschinaError } from "@maschina/core";
import {
	type CrossingState,
	levelsOf,
	type MachineKindRegistry,
	observePrice,
	startWatching,
	type WatchedLevel,
} from "@maschina/runtime";
import type { Logger } from "@maschina/telemetry";

type WatchingMachine = { machineId: string; kind: string; settings: unknown };

export type PriceWatcherPorts = {
	/** The kinds this orchestrator knows. A kind says which prices it waits on; the watcher asks. */
	kinds: MachineKindRegistry;
	/** The machines that could act on a crossing right now. */
	watching(): Promise<WatchingMachine[]>;
	/** Prices in micro-dollars, for the tokens machines are waiting on. */
	pricesFor(mints: string[]): Promise<Map<string, bigint>>;
	/** Puts a run in the queue. The same occurrence is only ever queued once. */
	queue(run: {
		machineId: string;
		occurrenceKey: string;
		dueAt: Date;
		/** Which level fired, so the machine can be told what woke it. */
		wokeOn: string;
	}): Promise<void>;
	logger: Logger;
	now(): Date;
	/** How long to wait between looks at the market. */
	sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
	everyMs?: number;
};

const DEFAULT_EVERY_MS = 15_000;

const pause = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});

/** Runs until `signal` aborts. */
export async function watchPrices(ports: PriceWatcherPorts, signal: AbortSignal): Promise<void> {
	const { kinds, watching, pricesFor, queue, logger, now } = ports;
	const sleep = ports.sleep ?? pause;
	const everyMs = ports.everyMs ?? DEFAULT_EVERY_MS;
	/** What each level has seen so far, keyed by machine and level, so each fires once per crossing. */
	const seen = new Map<string, CrossingState>();
	let failures = 0;

	while (!signal.aborted) {
		try {
			const machines = await watching();
			if (machines.length === 0) {
				// Nobody is waiting, so nothing is asked for. Prices cost quota.
				await sleep(everyMs, signal);
				continue;
			}

			/** Every level being waited on this tick, with the machine it belongs to. */
			const watched: { machineId: string; level: WatchedLevel }[] = [];
			const mints = new Set<string>();
			for (const machine of machines) {
				if (!kinds.has(machine.kind)) {
					logger.warn(
						{ machineId: machine.machineId, kind: machine.kind },
						"this orchestrator does not know the kind of a machine that is waiting",
					);
					continue;
				}
				const levels = levelsOf(kinds, machine.kind, machine.settings);
				if (levels.length === 0) continue;
				for (const level of levels) {
					watched.push({ machineId: machine.machineId, level });
					mints.add(level.pricedMint);
				}
			}

			if (watched.length === 0) {
				// Machines are waiting, but none of them on a price. Asking would cost quota for nothing.
				await sleep(everyMs, signal);
				continue;
			}

			const prices = await pricesFor([...mints]);
			if (failures > 0) {
				logger.info({ after: failures }, "prices are being answered again");
				failures = 0;
			}

			for (const { machineId, level } of watched) {
				const price = prices.get(level.pricedMint);
				if (price === undefined) {
					logger.warn({ machineId, mint: level.pricedMint }, "no price for this token");
					continue;
				}

				// Crossings are kept per level, not per machine, so one edge firing leaves the other
				// exactly as it was.
				const key = `${machineId}:${level.id}`;
				const crossing = observePrice(seen.get(key) ?? startWatching(), {
					price,
					level: level.level,
					direction: level.direction,
					hysteresisBps: level.hysteresisBps,
					minGapMs: level.minGapMs,
					now: now(),
				});
				seen.set(key, crossing.state);
				if (!crossing.fire) continue;

				const at = now();
				await queue({
					machineId,
					wokeOn: level.id,
					// One run per crossing, and the level that fired is named in it, so the machine can be
					// told which of its levels woke it.
					occurrenceKey: `price:${level.id}:${level.level}:${at.toISOString()}`,
					dueAt: at,
				});
				logger.info(
					{ machineId, level: level.id, price: price.toString(), at: level.level.toString() },
					"a price crossed a level, so a run is queued",
				);
			}
		} catch (error) {
			failures += 1;
			// A price source having a bad minute is not a reason to stop watching, but it is worth saying,
			// because a long outage means machines are not acting on levels they were given.
			logger[failures > 3 ? "error" : "warn"]({ err: error, failures }, "could not look at prices");
			if (failures === 4) {
				logger.error(
					new MaschinaError("unavailable", "prices have been unreadable for four tries"),
					"the price watcher is blind",
				);
			}
		}

		await sleep(everyMs, signal);
	}
}
