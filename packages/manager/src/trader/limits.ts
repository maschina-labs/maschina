/**
 * The AI trader's limits: set by the owner when it is made, checked in code before every trade, and out
 * of the AI's reach. It has no tool that changes them and nothing it says can loosen them.
 *
 * They are about the money it was given, not about which tokens are good (D-097: on the open market
 * that is the owner's call and the trader's). Money only ever goes into a trade from its own cash and
 * back into its own cash; there is nowhere else for it to go.
 */

import type { Book, Holding } from "./book.ts";

export type TraderLimits = {
	/** The most one buy may spend, in USDC's smallest unit. */
	maxPerTrade: bigint;
	/** How many different tokens it may hold at once. */
	maxPositions: number;
	/**
	 * A holding down this far from what it cost is sold by the engine, not the AI: the stop is not a
	 * suggestion it can talk itself out of. Percent, e.g. 15.
	 */
	stopLossPct: number;
	/** The whole book down this far from what it started with pauses the trader. Percent. */
	drawdownPausePct: number;
	/** The most trades in any one hour, so a confused model cannot churn the cash into fees. */
	maxTradesPerHour: number;
	/** The most any one trade may move the price, in percent: past this, fees and impact eat the edge. */
	maxImpactPct: number;
};

export const DEFAULT_LIMITS: TraderLimits = {
	maxPerTrade: 10_000_000n,
	maxPositions: 6,
	stopLossPct: 15,
	drawdownPausePct: 30,
	maxTradesPerHour: 60,
	maxImpactPct: 3,
};

export type Verdict = { allowed: true } | { allowed: false; reason: string; pause?: boolean };

const dollars = (units: bigint) => `$${(Number(units) / 1_000_000).toFixed(2)}`;

export function tradesInLastHour(book: Book, now: Date): number {
	const since = now.getTime() - 3_600_000;
	return book.fills.filter((fill) => fill.at.getTime() > since).length;
}

/** Whether the book has lost enough that the trader must stop until its owner looks. */
export function drawdownHit(book: Book, worthNow: bigint, limits: TraderLimits): boolean {
	if (book.startingCash === 0n) return false;
	const lostPct = (Number(book.startingCash - worthNow) / Number(book.startingCash)) * 100;
	return lostPct >= limits.drawdownPausePct;
}

export function checkBuy(
	book: Book,
	request: { mint: string; usdc: bigint; impactPct: number; now: Date; worthNow: bigint },
	limits: TraderLimits,
): Verdict {
	if (drawdownHit(book, request.worthNow, limits))
		return {
			allowed: false,
			pause: true,
			reason: `the book is down ${limits.drawdownPausePct}% or more from where it started`,
		};
	if (request.usdc <= 0n) return { allowed: false, reason: "a buy must spend something" };
	if (request.usdc > limits.maxPerTrade)
		return {
			allowed: false,
			reason: `${dollars(request.usdc)} is over the ${dollars(limits.maxPerTrade)} limit per trade`,
		};
	if (request.usdc > book.cash)
		return { allowed: false, reason: `only ${dollars(book.cash)} of cash is left` };
	const holds = book.holdings.some((each) => each.mint === request.mint);
	if (!holds && book.holdings.length >= limits.maxPositions)
		return {
			allowed: false,
			reason: `already holding ${limits.maxPositions} tokens, the most allowed`,
		};
	if (tradesInLastHour(book, request.now) >= limits.maxTradesPerHour)
		return {
			allowed: false,
			reason: `already ${limits.maxTradesPerHour} trades this hour, the most allowed`,
		};
	if (!(request.impactPct <= limits.maxImpactPct))
		return {
			allowed: false,
			reason: `the trade would move the price ${request.impactPct}%, over the ${limits.maxImpactPct}% limit`,
		};
	return { allowed: true };
}

/** Selling is always allowed, whatever else is true: getting out is never what a limit stops. */
export const checkSell = (): Verdict => ({ allowed: true });

/** The holdings the engine must sell now, because each is down past the stop from what it cost. */
export function stopsHit(
	holdings: Holding[],
	sellsFor: (held: Holding) => bigint | undefined,
	limits: TraderLimits,
): Holding[] {
	return holdings.filter((held) => {
		const value = sellsFor(held);
		if (value === undefined || held.cost === 0n) return false;
		const downPct = (Number(held.cost - value) / Number(held.cost)) * 100;
		return downPct >= limits.stopLossPct;
	});
}
