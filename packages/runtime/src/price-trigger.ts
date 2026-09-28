/**
 * When a price crosses a level, and when it has crossed enough to count.
 *
 * A price that sits near a level wobbles across it constantly. Acting on every wobble would fill a
 * machine's day with trades it did not mean to make, so three things have to hold before a level fires:
 *
 *   1. The price crossed, rather than starting on the far side. A machine set to buy at 142 does not
 *      buy the moment it is created while the price is already 140.
 *   2. Since the last firing, the price came back clear of the level, by the hysteresis, before it
 *      crossed again. Clear means genuinely away from it, not one cent past.
 *   3. Enough time has passed since the last run, whatever the price did.
 *
 * Prices are in micro-dollars, the same as everywhere else.
 */

import { MaschinaError } from "@maschina/core";

export type TriggerDirection = "falls_to" | "rises_to";

export type CrossingState = {
	/**
	 * Whether a crossing would count right now. A machine begins unarmed: it has to be seen on the far
	 * side of its level first, so it never fires on the price it was created at.
	 */
	armed: boolean;
	/** Set once the first price has been seen, which is when a machine decides if it starts armed. */
	seen?: true;
	lastFiredAt?: Date;
};

export type CrossingInput = {
	price: bigint;
	level: bigint;
	direction: TriggerDirection;
	/** How far clear of the level the price must go before the level can fire again. */
	hysteresisBps: number;
	/** The least time between two runs of this machine. */
	minGapMs: number;
	now: Date;
};

export const startWatching = (): CrossingState => ({ armed: false });

const BPS = 10_000n;

/** Has the price reached the level, in the direction the machine cares about? */
const reached = (price: bigint, level: bigint, direction: TriggerDirection) =>
	direction === "falls_to" ? price <= level : price >= level;

/** Is the price clear of the level, far enough to count as away from it? */
function clearOf(price: bigint, level: bigint, direction: TriggerDirection, hysteresisBps: number) {
	const margin = (level * BigInt(hysteresisBps)) / BPS;
	return direction === "falls_to" ? price > level + margin : price < level - margin;
}

export type Crossing = { state: CrossingState; fire: boolean };

/** Takes one price and says whether this machine should run. */
export function observePrice(state: CrossingState, input: CrossingInput): Crossing {
	const { price, level, direction, hysteresisBps, minGapMs, now } = input;
	if (level <= 0n) throw new MaschinaError("invalid_input", "a level is a price above zero");
	if (!Number.isInteger(hysteresisBps) || hysteresisBps < 0) {
		throw new MaschinaError("invalid_input", "the hysteresis is a whole number of basis points");
	}
	if (!Number.isInteger(minGapMs) || minGapMs < 0) {
		throw new MaschinaError("invalid_input", "the minimum gap is a whole number of milliseconds");
	}

	// The first price decides where the machine starts. On the far side of its level it is armed at once,
	// however close: the margin is for re-arming after a run, not for starting. Past the level it waits, so
	// it never acts on the price it was created at. This is also where a restart begins, so a deploy never
	// leaves a machine disarmed (2026-09-28: one started 0.4% above its level ignored the dip).
	if (!state.seen) {
		return {
			state: { ...state, seen: true, armed: !reached(price, level, direction) },
			fire: false,
		};
	}

	// After that, being clear of the level by the margin is what arms it again once it has run.
	if (clearOf(price, level, direction, hysteresisBps)) {
		return { state: { ...state, armed: true }, fire: false };
	}

	if (!state.armed || !reached(price, level, direction)) return { state, fire: false };

	const since = state.lastFiredAt ? now.getTime() - state.lastFiredAt.getTime() : undefined;
	if (since !== undefined && since < minGapMs) {
		// Too soon. The machine stays armed, so the crossing still counts once the gap has passed.
		return { state, fire: false };
	}

	return { state: { armed: false, seen: true, lastFiredAt: now }, fire: true };
}
