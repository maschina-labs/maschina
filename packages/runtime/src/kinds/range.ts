/**
 * A machine that works a band: buys the bottom, sells the top, and repeats.
 *
 * This is the first kind that closes what it opened. The two edges are watched at once, and the run
 * says which one fired, so the machine acts on the edge that crossed rather than on where the price
 * happens to be by the time a node claims the run. Between the crossing and the decision the price can
 * move back inside the band, and a machine reading the price at that moment would sell what it just
 * bought.
 *
 * One position at a time, on purpose. A range machine with no limit buys every time the price falls to
 * its low edge, which in a falling market means spending the entire budget on the way down and holding
 * all of it in the token that kept falling. So it counts itself as in the market once it holds at least
 * `minBase`, and will not buy again until it has sold.
 *
 * What it spends is dollars and what it holds is the token, so its budget is counted in dollars: a sale
 * puts the money back and the machine can go again. That is what makes it a machine that can run rather
 * than one that runs down.
 *
 * A band narrower than the cost of working it is refused outright. Two swaps per round trip, each paying
 * a pool fee and some slippage and costing something to send, and a band inside all of that loses money
 * every time the machine works perfectly. See `meetsMinimumEdge`.
 */

import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import { DEFAULT_ROUND_TRIP_COST_BPS, meetsMinimumEdge } from "@maschina/rules";
import type { Decision, MachineKind, MachineView, WatchedLevel } from "../machine-kind.ts";

export type RangeSettings = {
	/** What the machine spends and comes back to. Its budget is counted in this. */
	quoteMint: string;
	/** What it buys and holds while it is in the market. The band is a price of this. */
	baseMint: string;
	/** The bottom of the band, in micro-dollars. Below this it buys. */
	buyLevel: BaseUnits;
	/** The top of the band, in micro-dollars. Above this it sells. */
	sellLevel: BaseUnits;
	/** How much to spend on one buy, in the quote token's smallest unit. */
	amountPerBuy: BaseUnits;
	/**
	 * The least of the base token that counts as holding a position.
	 *
	 * Anything under this is dust: a rounding leftover from a sale, or a fraction somebody sent. Without
	 * it a machine that sold all but a few lamports would think it was still in the market forever.
	 */
	minBase: BaseUnits;
	slippageBps: number;
	/** How far clear of an edge the price must go before that edge can fire again. */
	hysteresisBps: number;
	/**
	 * The narrowest band this machine will accept, in basis points.
	 *
	 * Raised by an owner who wants more room, never lowered below what a round trip costs: lowering it
	 * does not make trading cheaper.
	 */
	minEdgeBps: number;
	/** The least time between two runs from the same edge. */
	minGapMs: number;
};

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Half a percent clear of an edge, and a minute between runs, unless the owner says otherwise. */
const DEFAULT_HYSTERESIS_BPS = 50;
const DEFAULT_MIN_GAP_MS = 60_000;

function readAmount(value: unknown): BaseUnits | undefined {
	if (typeof value === "bigint") return value >= 0n ? baseUnitsOf(value) : undefined;
	if (typeof value === "string" && /^\d+$/.test(value)) return baseUnitsOf(BigInt(value));
	return undefined;
}

const whole = (value: unknown, fallback: number): number | undefined => {
	if (value === undefined) return fallback;
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
};

export const range: MachineKind<RangeSettings> = {
	kind: "range",

	readSettings(settings) {
		if (typeof settings !== "object" || settings === null) {
			return { ok: false, problem: "a range machine needs settings" };
		}
		const raw = settings as Record<string, unknown>;

		const quoteMint = typeof raw["quoteMint"] === "string" ? raw["quoteMint"] : undefined;
		const baseMint = typeof raw["baseMint"] === "string" ? raw["baseMint"] : undefined;
		if (!quoteMint || !MINT.test(quoteMint)) {
			return { ok: false, problem: "quoteMint is the token this machine spends" };
		}
		if (!baseMint || !MINT.test(baseMint)) {
			return { ok: false, problem: "baseMint is the token this machine trades" };
		}
		if (quoteMint === baseMint) {
			return { ok: false, problem: "a range machine trades two different tokens" };
		}

		const buyLevel = readAmount(raw["buyLevel"]);
		const sellLevel = readAmount(raw["sellLevel"]);
		if (buyLevel === undefined || buyLevel <= 0n) {
			return { ok: false, problem: "buyLevel is the bottom of the band, a price above zero" };
		}
		if (sellLevel === undefined || sellLevel <= 0n) {
			return { ok: false, problem: "sellLevel is the top of the band, a price above zero" };
		}
		if (sellLevel <= buyLevel) {
			// A band that is upside down or has no width would buy high and sell low, for a fee, forever.
			return { ok: false, problem: "the top of the band has to be above the bottom" };
		}

		const minEdgeBps = whole(raw["minEdgeBps"], DEFAULT_ROUND_TRIP_COST_BPS);
		if (minEdgeBps === undefined) {
			return { ok: false, problem: "minEdgeBps is a whole number of basis points" };
		}
		// The most expensive mistake available here: a band narrower than the cost of working it loses
		// money every time the machine does exactly what it was asked to. Nothing about it looks wrong.
		const edge = meetsMinimumEdge({ buyLevel, sellLevel, minEdgeBps });
		if (!edge.ok) return { ok: false, problem: edge.problem };

		const amountPerBuy = readAmount(raw["amountPerBuy"]);
		if (amountPerBuy === undefined || amountPerBuy <= 0n) {
			return { ok: false, problem: "amountPerBuy is how much to spend on one buy" };
		}

		const minBase = readAmount(raw["minBase"] ?? 0n);
		if (minBase === undefined) {
			return { ok: false, problem: "minBase is the least that counts as holding a position" };
		}

		const slippageBps = whole(raw["slippageBps"], 50);
		if (slippageBps === undefined || slippageBps > 10_000) {
			return { ok: false, problem: "slippageBps is a whole number of basis points" };
		}
		const hysteresisBps = whole(raw["hysteresisBps"], DEFAULT_HYSTERESIS_BPS);
		if (hysteresisBps === undefined) {
			return { ok: false, problem: "hysteresisBps is a whole number of basis points" };
		}
		const minGapMs = whole(raw["minGapMs"], DEFAULT_MIN_GAP_MS);
		if (minGapMs === undefined) {
			return { ok: false, problem: "minGapMs must be a whole number of milliseconds" };
		}

		return {
			ok: true,
			value: {
				quoteMint,
				baseMint,
				buyLevel,
				sellLevel,
				amountPerBuy,
				minBase,
				slippageBps,
				hysteresisBps,
				minEdgeBps,
				minGapMs,
			},
		};
	},

	/** Both edges, named for what the machine does when each one fires. */
	levels(settings): readonly WatchedLevel[] {
		const shared = {
			pricedMint: settings.baseMint,
			hysteresisBps: settings.hysteresisBps,
			minGapMs: settings.minGapMs,
		};
		return [
			{ id: "buy", level: settings.buyLevel, direction: "falls_to", ...shared },
			{ id: "sell", level: settings.sellLevel, direction: "rises_to", ...shared },
		];
	},

	/** What it spends is what its budget is counted in, so a sale returns the money. */
	budgetMint(settings) {
		return settings.quoteMint;
	},

	decide(settings, view: MachineView): Decision {
		const held = view.balances.get(settings.baseMint) ?? baseUnitsOf(0n);
		const holdingPosition = held >= settings.minBase && held > 0n;

		if (view.wokeOn === "buy") {
			if (holdingPosition) {
				return {
					decide: "wait",
					because: "limit_reached",
					detail: "this machine already holds a position, and holds one at a time",
				};
			}
			if (view.availableBudget < settings.amountPerBuy) {
				return {
					decide: "wait",
					because: "budget_exhausted",
					detail: `a buy needs ${settings.amountPerBuy}, and ${view.availableBudget} is left in the budget`,
				};
			}
			const dollars = view.balances.get(settings.quoteMint) ?? baseUnitsOf(0n);
			if (dollars < settings.amountPerBuy) {
				return {
					decide: "wait",
					because: "balance_too_low",
					detail: `a buy needs ${settings.amountPerBuy}, and the wallet holds ${dollars}`,
				};
			}

			return {
				decide: "act",
				action: {
					do: "swap",
					inputMint: settings.quoteMint,
					outputMint: settings.baseMint,
					inputAmount: settings.amountPerBuy,
					slippageBps: settings.slippageBps,
				},
				because: `the price fell to ${settings.buyLevel}, the bottom of the band`,
			};
		}

		if (view.wokeOn === "sell") {
			if (!holdingPosition) {
				return {
					decide: "wait",
					because: "balance_too_low",
					detail: `a sale needs ${settings.minBase}, and the wallet holds ${held}`,
				};
			}

			// The whole position, not a part of it. A range machine is either in or out, and leaving a
			// remainder behind would count as still holding and block the next buy.
			return {
				decide: "act",
				action: {
					do: "swap",
					inputMint: settings.baseMint,
					outputMint: settings.quoteMint,
					inputAmount: held,
					slippageBps: settings.slippageBps,
				},
				because: `the price rose to ${settings.sellLevel}, the top of the band`,
			};
		}

		// No edge, or one this machine does not have. Either way there is nothing to act on, and reading
		// the price instead would be deciding on something nobody asked about.
		return {
			decide: "wait",
			because: "not_due",
			detail: view.wokeOn
				? `this run names ${view.wokeOn}, which is not an edge of this band`
				: "this machine acts on an edge, and this run names none",
		};
	},
};
