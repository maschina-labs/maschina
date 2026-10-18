/**
 * Whether the quote a machine was given is one the owner allowed.
 *
 * The rules in `trade.ts` judge what a trade spends. These judge the price it accepted, which is a
 * different question and was, until now, nobody's. The node picked the slippage, the node computed
 * the floor, the node read the price impact, and the signer took all three on trust while checking
 * the amount carefully. So the one number an attacker would actually move was the unguarded one.
 *
 * It matters more since F-01. `judgeSwap` holds a transaction to `minimumOutputAmount`, which makes
 * that floor the single thing standing between a measured trade and a terrible one. A floor supplied
 * by the same party the measurement exists to distrust is not a floor. These checks are what make it
 * one, so they run before anything is simulated.
 *
 * Three questions, in the order of how fundamental they are:
 *
 *   - **Is the slippage inside the owner's cap?** The owner's number, never the node's. Over it means
 *     something upstream is wrong or tampered with, so the machine stops.
 *   - **Does the floor match the slippage the quote itself claims?** 50 bps of a million is 995,000.
 *     A proposal claiming 50 bps while accepting less is contradicting itself, and nothing honest
 *     does that. The machine stops for this too.
 *   - **Is the price impact known, and small enough?** A thin market is the market, not a fault, so
 *     this refuses without stopping anything. Unknown counts as too large: an impact nobody could
 *     read is not evidence of a small one.
 *
 * Pure, like `trade.ts` and `derive-effects.ts`, and for the same reason: it is on the money path, so
 * it goes to Rust early and its vectors become part of the conformance suite.
 */

import type { BaseUnits } from "@maschina/core";

/**
 * The caps that apply when the owner has set none of their own.
 *
 * A ceiling, not a target. Chosen wide enough that nothing currently running is disturbed, since the
 * machine kinds all quote at 50 bps, and narrow enough that a proposal asking to accept half its own
 * value is refused. An owner who wants a real limit sets one; what this prevents is the absence of a
 * limit meaning no limit, which is the rule the rest of the system already follows.
 */
export const DEFAULT_MAX_SLIPPAGE_BPS = 300;
export const DEFAULT_MAX_PRICE_IMPACT_BPS = 300;

export const QUOTE_RULES = ["slippage_cap", "minimum_output", "price_impact"] as const;

export type QuoteRule = (typeof QUOTE_RULES)[number];

export type QuoteDecision =
	| { allowed: true }
	| { allowed: false; rule: QuoteRule; reason: string; pause?: "other" };

export type QuoteCheck = {
	/** What the router expects the trade to produce. */
	quotedOutputAmount: BaseUnits;
	/** The least it may produce. After this passes, it is what `judgeSwap` holds the bytes to. */
	minimumOutputAmount: BaseUnits;
	/** The slippage the proposal says it accepted. */
	slippageBps: number;
	/** How far this trade is expected to move the price against itself. */
	priceImpactBps: number;
	/** The widest slippage the owner allows. */
	maxSlippageBps: number;
	/** The largest price impact the owner allows. */
	maxPriceImpactBps: number;
};

const refuse = (rule: QuoteRule, reason: string, pause?: "other"): QuoteDecision =>
	pause ? { allowed: false, rule, reason, pause } : { allowed: false, rule, reason };

/** The least a quote may accept and still match the slippage it claims. */
export function floorFor(quotedOutputAmount: bigint, slippageBps: number): bigint {
	return (quotedOutputAmount * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function checkQuote(check: QuoteCheck): QuoteDecision {
	const quoted = BigInt(check.quotedOutputAmount);
	const minimum = BigInt(check.minimumOutputAmount);

	// 1. The owner's cap, which is the only one of the three that is not the proposal's own word.
	if (!Number.isInteger(check.slippageBps) || check.slippageBps < 0) {
		return refuse("slippage_cap", `${check.slippageBps} is not a number of basis points`, "other");
	}
	if (check.slippageBps > check.maxSlippageBps) {
		return refuse(
			"slippage_cap",
			`this quote accepts ${check.slippageBps} bps of slippage, and ${check.maxSlippageBps} is allowed`,
			"other",
		);
	}

	// 2. The proposal against itself. A floor of nothing is not a floor, however it is arrived at.
	if (quoted <= 0n || minimum <= 0n) {
		return refuse(
			"minimum_output",
			`a quote of ${quoted} with a floor of ${minimum} promises nothing`,
			"other",
		);
	}
	const floor = floorFor(quoted, check.slippageBps);
	if (minimum < floor) {
		return refuse(
			"minimum_output",
			`it accepts as little as ${minimum} while claiming ${check.slippageBps} bps of slippage, which is ${floor}`,
			"other",
		);
	}

	// 3. The market. Refused, not stopped: this one is true again in an hour.
	if (!Number.isFinite(check.priceImpactBps)) {
		return refuse("price_impact", "the price impact of this trade could not be read");
	}
	if (check.priceImpactBps > check.maxPriceImpactBps) {
		return refuse(
			"price_impact",
			`this trade moves the price ${check.priceImpactBps} bps, and ${check.maxPriceImpactBps} is allowed`,
		);
	}

	return { allowed: true };
}
