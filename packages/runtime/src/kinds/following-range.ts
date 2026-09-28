/**
 * A range that follows the price: buys dips, sells rises, and never gets left behind.
 *
 * The fixed range works one band. When the price leaves it, the machine sits there waiting for a price
 * that may never come back, and somebody has to come and move it. This one moves itself, which is the
 * difference between a tool and money that works while its owner sleeps (D-089).
 *
 * Its band sits around an anchor price:
 *
 *   holding what it spends   buys a dip of half the band below the anchor. If the price rises half the
 *                            band above it instead, the anchor moves up to meet it, and the band with it.
 *   holding what it bought   sells a full band above what it paid, then re-centres on the sale. If the
 *                            price falls through the floor below what it paid, it sells, takes that loss,
 *                            rests, and starts again around wherever the price is by then.
 *
 * It never moves the band while it holds a position. Moving it then would mean selling below what it
 * paid for no reason but that the price fell, and the only loss this machine may lock in is the floor
 * its owner chose.
 *
 * Everything that sets the anchor is in the record: a sale, or a `machine.recentred` event for the moves
 * that are not trades. So where the band sits can always be worked out again from history, and nothing
 * about it lives in a process that could restart.
 */

import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import { DEFAULT_ROUND_TRIP_COST_BPS } from "@maschina/rules";
import type {
	AnchorWanted,
	Decision,
	KindMemory,
	MachineKind,
	MachineView,
	RememberedEvent,
	WatchedLevel,
} from "../machine-kind.ts";

export type FollowingRangeSettings = {
	/** What it spends and comes back to. Its budget and its float are counted in this. */
	quoteMint: string;
	/** What it buys and holds between a buy and a sale. Its band is a price of this. */
	baseMint: string;
	/** How many decimals the base token has, to turn its amounts into a price. SOL has nine. */
	baseDecimals: number;
	/** The whole width of the band, in basis points of the price. */
	bandBps: number;
	/** How much to spend on one buy, in the quote token's smallest unit. */
	amountPerBuy: BaseUnits;
	/** How far below what it paid the price may fall before it sells, in basis points. */
	floorBps: number;
	/** How long it rests after selling at the floor before starting again. */
	cooldownMs: number;
	/** The least of the base token that counts as holding a position. Anything under it is dust. */
	minBase: BaseUnits;
	slippageBps: number;
	hysteresisBps: number;
	minGapMs: number;
};

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BPS = 10_000n;
const DEFAULT_FLOOR_BPS = 500;
const DEFAULT_COOLDOWN_MS = 3_600_000;
const DEFAULT_HYSTERESIS_BPS = 50;
const DEFAULT_MIN_GAP_MS = 60_000;

const whole = (value: unknown, fallback: number): number | undefined => {
	if (value === undefined) return fallback;
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
};

const readAmount = (value: unknown): BaseUnits | undefined => {
	if (typeof value === "bigint") return value >= 0n ? baseUnitsOf(value) : undefined;
	if (typeof value === "string" && /^\d+$/.test(value)) return baseUnitsOf(BigInt(value));
	return undefined;
};

/** What the record says about where this machine stands. */
export type FollowingState = {
	/** The price its band sits around, when it has one. */
	anchor?: bigint;
	/** When the anchor last moved. */
	anchorAt?: Date;
	/** True when the anchor was set by a sale that lost money: a floor. */
	anchorFromLoss: boolean;
	/** What it holds of the base token, from its own trades. */
	position: bigint;
	/** What that position cost, in the quote token. */
	basis: bigint;
};

/**
 * Where the machine stands, worked out from its record: the anchor, and the position it holds.
 *
 * Paper trades count the same as real ones, so a machine on paper follows the price exactly as a funded
 * one would.
 */
export function followingState(
	events: readonly RememberedEvent[],
	settings: FollowingRangeSettings,
): FollowingState {
	const state: FollowingState = { anchorFromLoss: false, position: 0n, basis: 0n };
	const intents = new Map<string, { inputMint: string; outputMint: string }>();
	const counted = new Set<string>();
	const unit = 10n ** BigInt(settings.baseDecimals);

	for (const event of events) {
		if (event.type === "machine.recentred") {
			state.anchor = BigInt(event.payload.price);
			state.anchorAt = event.occurredAt;
			state.anchorFromLoss = false;
			continue;
		}
		if (event.type === "trade.intended") {
			const { tradeId, inputMint, outputMint } = event.payload;
			if (!intents.has(tradeId)) intents.set(tradeId, { inputMint, outputMint });
			continue;
		}

		const done =
			event.type === "trade.completed"
				? {
						id: event.payload.tradeId,
						spent: BigInt(event.payload.inputAmount),
						got: BigInt(event.payload.outputAmount),
					}
				: event.type === "trade.simulated"
					? {
							id: event.payload.tradeId,
							spent: BigInt(event.payload.inputAmount),
							got: BigInt(event.payload.quotedOutputAmount),
						}
					: undefined;
		if (!done || counted.has(done.id)) continue;
		const intent = intents.get(done.id);
		if (!intent) continue;
		counted.add(done.id);

		if (intent.inputMint === settings.quoteMint && intent.outputMint === settings.baseMint) {
			state.basis += done.spent;
			state.position += done.got;
			continue;
		}
		if (intent.inputMint === settings.baseMint && intent.outputMint === settings.quoteMint) {
			const sold = done.spent > state.position ? state.position : done.spent;
			const cost = state.position > 0n ? (state.basis * sold) / state.position : 0n;
			// The price it sold at, in micro-dollars per whole token, is where the band sits next.
			if (done.spent > 0n) state.anchor = (done.got * unit) / done.spent;
			state.anchorAt = event.occurredAt;
			state.anchorFromLoss = done.got < cost;
			state.basis -= cost;
			state.position -= sold;
		}
	}
	return state;
}

const holds = (state: FollowingState, settings: FollowingRangeSettings) =>
	state.position > 0n && state.position >= settings.minBase;

const resting = (state: FollowingState, settings: FollowingRangeSettings, now: Date) =>
	state.anchorFromLoss &&
	state.anchorAt !== undefined &&
	now.getTime() < state.anchorAt.getTime() + settings.cooldownMs;

export const followingRange: MachineKind<FollowingRangeSettings> = {
	kind: "following_range",

	readSettings(settings) {
		if (typeof settings !== "object" || settings === null) {
			return { ok: false, problem: "a following range needs settings" };
		}
		const raw = settings as Record<string, unknown>;
		const quoteMint = raw["quoteMint"];
		const baseMint = raw["baseMint"];
		if (typeof quoteMint !== "string" || !MINT.test(quoteMint)) {
			return { ok: false, problem: "quoteMint is the token this machine spends" };
		}
		if (typeof baseMint !== "string" || !MINT.test(baseMint)) {
			return { ok: false, problem: "baseMint is the token this machine trades" };
		}
		if (quoteMint === baseMint) {
			return { ok: false, problem: "a following range trades two different tokens" };
		}
		const baseDecimals = whole(raw["baseDecimals"], 9);
		if (baseDecimals === undefined || baseDecimals > 18) {
			return { ok: false, problem: "baseDecimals is a whole number of decimals" };
		}
		const bandBps = whole(raw["bandBps"], -1);
		if (bandBps === undefined || bandBps < 0) {
			return { ok: false, problem: "bandBps is how wide the band is, in basis points" };
		}
		if (bandBps < DEFAULT_ROUND_TRIP_COST_BPS) {
			return {
				ok: false,
				problem: `this band is ${bandBps} basis points wide, and a round trip costs about ${DEFAULT_ROUND_TRIP_COST_BPS}`,
			};
		}
		if (bandBps > 5_000) {
			return { ok: false, problem: "a band wider than half the price is not a band" };
		}
		const amountPerBuy = readAmount(raw["amountPerBuy"]);
		if (amountPerBuy === undefined || amountPerBuy <= 0n) {
			return { ok: false, problem: "amountPerBuy is how much to spend on one buy" };
		}
		const floorBps = whole(raw["floorBps"], DEFAULT_FLOOR_BPS);
		if (floorBps === undefined || floorBps < 100 || floorBps > 5_000) {
			return { ok: false, problem: "floorBps is between one and fifty percent, in basis points" };
		}
		const cooldownMs = whole(raw["cooldownMs"], DEFAULT_COOLDOWN_MS);
		if (cooldownMs === undefined) {
			return { ok: false, problem: "cooldownMs is a whole number of milliseconds" };
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
				baseDecimals,
				bandBps,
				amountPerBuy,
				floorBps,
				cooldownMs,
				minBase,
				slippageBps,
				hysteresisBps,
				minGapMs,
			},
		};
	},

	budgetMint(settings) {
		return settings.quoteMint;
	},

	needsAnchor(settings, memory: KindMemory): AnchorWanted | undefined {
		const state = followingState(memory.events, settings);
		if (state.anchor === undefined) return { pricedMint: settings.baseMint, because: "started" };
		// Back from the floor: the band starts again around wherever the price is now, not around a price
		// from an hour ago that the market has already left.
		const rested =
			!holds(state, settings) && state.anchorFromLoss && !resting(state, settings, memory.now);
		return rested ? { pricedMint: settings.baseMint, because: "after_floor" } : undefined;
	},

	levels(settings, memory?: KindMemory): readonly WatchedLevel[] {
		if (!memory) return [];
		const state = followingState(memory.events, settings);
		if (state.anchor === undefined) return [];

		const band = BigInt(settings.bandBps);
		const half = band / 2n;
		const shared = {
			pricedMint: settings.baseMint,
			hysteresisBps: settings.hysteresisBps,
			minGapMs: settings.minGapMs,
		};

		if (holds(state, settings)) {
			const unit = 10n ** BigInt(settings.baseDecimals);
			const entry = (state.basis * unit) / state.position;
			return [
				{
					id: "sell",
					level: baseUnitsOf((entry * (BPS + band)) / BPS),
					direction: "rises_to",
					...shared,
				},
				{
					id: "floor",
					level: baseUnitsOf((entry * (BPS - BigInt(settings.floorBps))) / BPS),
					direction: "falls_to",
					...shared,
				},
			];
		}

		// Resting after the floor, or waiting to be given a fresh price once the rest is over.
		if (state.anchorFromLoss) return [];

		return [
			{
				id: "buy",
				level: baseUnitsOf((state.anchor * (BPS - half)) / BPS),
				direction: "falls_to",
				...shared,
			},
			{
				id: "follow",
				level: baseUnitsOf((state.anchor * (BPS + half)) / BPS),
				direction: "rises_to",
				recentres: true,
				...shared,
			},
		];
	},

	decide(settings, view: MachineView): Decision {
		const held = view.balances.get(settings.baseMint) ?? baseUnitsOf(0n);
		const holding = held > 0n && held >= settings.minBase;

		if (view.wokeOn === "buy") {
			if (holding) {
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
				because: "the price dipped to the bottom of the band",
			};
		}

		if (view.wokeOn === "sell" || view.wokeOn === "floor") {
			if (!holding) {
				return {
					decide: "wait",
					because: "balance_too_low",
					detail: `a sale needs ${settings.minBase}, and the wallet holds ${held}`,
				};
			}
			// Everything it holds. A following range is either in or out, and a remainder would read as
			// still holding and keep the band from moving.
			return {
				decide: "act",
				action: {
					do: "swap",
					inputMint: settings.baseMint,
					outputMint: settings.quoteMint,
					inputAmount: held,
					slippageBps: settings.slippageBps,
				},
				because:
					view.wokeOn === "floor"
						? "the price fell through the floor, so it sells and takes the loss it was set to take"
						: "the price rose a full band above what it paid",
			};
		}

		return {
			decide: "wait",
			because: "not_due",
			detail: view.wokeOn
				? `this run names ${view.wokeOn}, which this machine does not act on`
				: "this machine acts on a level, and this run names none",
		};
	},
};
