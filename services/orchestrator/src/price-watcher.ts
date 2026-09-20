/**
 * Following prices for the machines waiting on them.
 *
 * Machines that trade on a level cannot watch prices themselves: they only wake when they have a run.
 * So the orchestrator watches, and turns a crossing into a queued run. Deciding whether a crossing
 * counts is not done here (see `observePrice` in the runtime), because that decision has nothing to do
 * with the network and is better tested without it.
 *
 * Two things this must never do: queue a run for a crossing that did not happen, and stop watching
 * because a price source had a bad minute. An outage is reported and the loop carries on.
 */

import { MaschinaError } from "@maschina/core";
import { type CrossingState, observePrice, priceTrigger, startWatching } from "@maschina/runtime";
import type { Logger } from "@maschina/telemetry";

type WatchingMachine = { machineId: string; kind: string; settings: unknown };

export type PriceWatcherPorts = {
	/** The machines that could act on a crossing right now. */
	watching(): Promise<WatchingMachine[]>;
	/** Prices in micro-dollars, for the tokens machines are waiting on. */
	pricesFor(mints: string[]): Promise<Map<string, bigint>>;
	/** Puts a run in the queue. The same occurrence is only ever queued once. */
	queue(run: { machineId: string; occurrenceKey: string; dueAt: Date }): Promise<void>;
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
	const { watching, pricesFor, queue, logger, now } = ports;
	const sleep = ports.sleep ?? pause;
	const everyMs = ports.everyMs ?? DEFAULT_EVERY_MS;
	/** What each machine has seen so far, so a level fires once per crossing. */
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

			type Settings = Extract<ReturnType<typeof priceTrigger.readSettings>, { ok: true }>;
			const settings = new Map<string, Settings>();
			const mints = new Set<string>();
			for (const machine of machines) {
				const read = priceTrigger.readSettings(machine.settings);
				if (!read.ok) {
					logger.warn(
						{ machineId: machine.machineId, problem: read.problem },
						"a machine is waiting on a price it did not describe properly",
					);
					continue;
				}
				settings.set(machine.machineId, read);
				mints.add(read.value.buyMint);
			}

			const prices = await pricesFor([...mints]);
			if (failures > 0) {
				logger.info({ after: failures }, "prices are being answered again");
				failures = 0;
			}

			for (const [machineId, read] of settings) {
				const price = prices.get(read.value.buyMint);
				if (price === undefined) {
					logger.warn({ machineId, mint: read.value.buyMint }, "no price for this token");
					continue;
				}

				const crossing = observePrice(seen.get(machineId) ?? startWatching(), {
					price,
					level: read.value.level,
					direction: read.value.direction,
					hysteresisBps: read.value.hysteresisBps,
					minGapMs: read.value.minGapMs,
					now: now(),
				});
				seen.set(machineId, crossing.state);
				if (!crossing.fire) continue;

				const at = now();
				await queue({
					machineId,
					// One run per crossing: the moment it crossed names the occurrence.
					occurrenceKey: `price:${read.value.level}:${at.toISOString()}`,
					dueAt: at,
				});
				logger.info(
					{ machineId, price: price.toString(), level: read.value.level.toString() },
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
