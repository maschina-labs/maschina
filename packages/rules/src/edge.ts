/**
 * Whether a trade can pay for itself.
 *
 * A machine that works a band does two swaps per round trip, and each one pays a pool fee, suffers some
 * slippage, and costs something to send. If the band is narrower than all of that, the machine loses
 * money every time it works exactly as designed. That is the most expensive mistake available to
 * somebody setting one up, because nothing about it looks wrong: the trades happen, the record is clean,
 * and the balance falls.
 *
 * Cost on Solana is per transaction rather than per dollar, so this is a floor on the band and not on the
 * amount. A wider band trading less often beats a narrow one trading constantly, and no amount of volume
 * fixes a band that cannot cover its own costs.
 *
 * The floor cannot be wished away. An owner may raise it and may not lower it, because lowering it does
 * not make trading cheaper.
 *
 * The number itself is deliberately conservative and deliberately in one place. Once fees are their own
 * line in the ledger it should be calibrated against what round trips really cost rather than estimated.
 */

/**
 * What a round trip costs, in basis points of the amount traded.
 *
 * Two swaps at up to 30 bps of pool fee each, a little slippage on both sides, and the transaction fees.
 * Sixty basis points is the smallest band that is not simply a donation.
 */
export const DEFAULT_ROUND_TRIP_COST_BPS = 60;

const BPS = 10_000n;

/** How wide a band is, in basis points of the price it buys at. Rounds down. */
export function edgeBps(buyLevel: bigint, sellLevel: bigint): number {
	if (buyLevel <= 0n || sellLevel <= buyLevel) return 0;
	return Number(((sellLevel - buyLevel) * BPS) / buyLevel);
}

export type EdgeCheck = {
	buyLevel: bigint;
	sellLevel: bigint;
	/** An owner's own floor, when they want a wider band than the default. Never narrower. */
	minEdgeBps?: number;
};

export type EdgeDecision =
	| { ok: true; edgeBps: number }
	| { ok: false; edgeBps: number; problem: string };

/** Whether a band is wide enough to cover the cost of working it. */
export function meetsMinimumEdge(check: EdgeCheck): EdgeDecision {
	const edge = edgeBps(check.buyLevel, check.sellLevel);
	const floor = Math.max(
		check.minEdgeBps ?? DEFAULT_ROUND_TRIP_COST_BPS,
		DEFAULT_ROUND_TRIP_COST_BPS,
	);

	if (edge < floor) {
		return {
			ok: false,
			edgeBps: edge,
			problem: `this band is ${edge} basis points wide, and a round trip costs about ${floor}`,
		};
	}
	return { ok: true, edgeBps: edge };
}
