/**
 * A machine that buys when a price reaches a level.
 *
 * The level itself is watched outside the machine, because prices move constantly and a machine only
 * wakes when it has a run. By the time this decides anything, the crossing has already happened and
 * been recorded. So the decision here is the same one every machine makes: can it afford this, does it
 * hold what it means to spend, and has it finished the job it was given.
 *
 * The level, the direction and the limits are still its settings, because they describe the machine,
 * and the watcher reads them from here.
 */

import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import type { Decision, MachineKind, MachineView } from "../machine-kind.ts";
import type { TriggerDirection } from "../price-trigger.ts";

export type PriceTriggerSettings = {
	spendMint: string;
	buyMint: string;
	/** The price to act at, in micro-dollars. */
	level: BaseUnits;
	direction: TriggerDirection;
	amountPerTrade: BaseUnits;
	slippageBps: number;
	/** How far clear of the level the price must go before this level can fire again. */
	hysteresisBps: number;
	/** The least time between two runs of this machine. */
	minGapMs: number;
	stopAfterTotal?: BaseUnits;
};

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Half a percent clear of the level, and an hour between runs, unless the owner says otherwise. */
const DEFAULT_HYSTERESIS_BPS = 50;
const DEFAULT_MIN_GAP_MS = 3_600_000;

function readAmount(value: unknown): BaseUnits | undefined {
	if (typeof value === "bigint") return value >= 0n ? baseUnitsOf(value) : undefined;
	if (typeof value === "string" && /^\d+$/.test(value)) return baseUnitsOf(BigInt(value));
	return undefined;
}

const whole = (value: unknown, fallback: number): number | undefined => {
	if (value === undefined) return fallback;
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
};

export const priceTrigger: MachineKind<PriceTriggerSettings> = {
	kind: "price_trigger",

	readSettings(settings) {
		if (typeof settings !== "object" || settings === null) {
			return { ok: false, problem: "settings are missing" };
		}
		const raw = settings as Record<string, unknown>;

		const spendMint = raw["spendMint"];
		const buyMint = raw["buyMint"];
		if (typeof spendMint !== "string" || !MINT.test(spendMint)) {
			return { ok: false, problem: "spendMint is not a token address" };
		}
		if (typeof buyMint !== "string" || !MINT.test(buyMint)) {
			return { ok: false, problem: "buyMint is not a token address" };
		}
		if (spendMint === buyMint) {
			return { ok: false, problem: "a machine cannot buy the token it is spending" };
		}

		const level = readAmount(raw["level"]);
		if (level === undefined || level === 0n) {
			return { ok: false, problem: "level must be a price above zero, in micro-dollars" };
		}
		const direction = raw["direction"];
		if (direction !== "falls_to" && direction !== "rises_to") {
			return { ok: false, problem: "direction must be falls_to or rises_to" };
		}

		const amountPerTrade = readAmount(raw["amountPerTrade"]);
		if (amountPerTrade === undefined || amountPerTrade === 0n) {
			return { ok: false, problem: "amountPerTrade must be a whole amount above zero" };
		}
		const stopAfterTotal =
			raw["stopAfterTotal"] === undefined ? undefined : readAmount(raw["stopAfterTotal"]);
		if (raw["stopAfterTotal"] !== undefined && stopAfterTotal === undefined) {
			return { ok: false, problem: "stopAfterTotal must be a whole amount" };
		}
		if (stopAfterTotal !== undefined && stopAfterTotal < amountPerTrade) {
			return { ok: false, problem: "stopAfterTotal is less than one trade" };
		}

		const slippageBps = raw["slippageBps"];
		if (
			typeof slippageBps !== "number" ||
			!Number.isInteger(slippageBps) ||
			slippageBps < 0 ||
			slippageBps > 10_000
		) {
			return { ok: false, problem: "slippageBps must be a whole number from 0 to 10000" };
		}

		const hysteresisBps = whole(raw["hysteresisBps"], DEFAULT_HYSTERESIS_BPS);
		if (hysteresisBps === undefined || hysteresisBps > 10_000) {
			return { ok: false, problem: "hysteresisBps must be a whole number from 0 to 10000" };
		}
		const minGapMs = whole(raw["minGapMs"], DEFAULT_MIN_GAP_MS);
		if (minGapMs === undefined) {
			return { ok: false, problem: "minGapMs must be a whole number of milliseconds" };
		}

		return {
			ok: true,
			value: {
				spendMint,
				buyMint,
				level,
				direction,
				amountPerTrade,
				slippageBps,
				hysteresisBps,
				minGapMs,
				...(stopAfterTotal === undefined ? {} : { stopAfterTotal }),
			},
		};
	},

	decide(settings, view: MachineView): Decision {
		const { amountPerTrade, stopAfterTotal } = settings;

		if (stopAfterTotal !== undefined) {
			const remaining = stopAfterTotal - view.totals.spent;
			if (remaining <= 0n) {
				return { decide: "stop", because: "the total this machine was set to spend is reached" };
			}
			if (remaining < amountPerTrade) {
				return {
					decide: "stop",
					because: "what is left of the total is less than one trade, so this was the last one",
				};
			}
		}

		if (view.availableBudget < amountPerTrade) {
			return {
				decide: "wait",
				because: "budget_exhausted",
				detail: `a trade needs ${amountPerTrade}, and ${view.availableBudget} is left in the budget`,
			};
		}

		const balance = view.balances.get(settings.spendMint) ?? baseUnitsOf(0n);
		if (balance < amountPerTrade) {
			return {
				decide: "wait",
				because: "balance_too_low",
				detail: `a trade needs ${amountPerTrade}, and the wallet holds ${balance}`,
			};
		}

		return {
			decide: "act",
			action: {
				do: "swap",
				inputMint: settings.spendMint,
				outputMint: settings.buyMint,
				inputAmount: amountPerTrade,
				slippageBps: settings.slippageBps,
			},
			because: `the price crossed ${settings.level}, ${settings.direction}`,
		};
	},
};

/**
 * The kinds that wait for a price rather than a schedule, named here because this is the module that
 * owns the kind. Anything that follows prices for machines reads this rather than the name.
 */
export const PRICE_WATCHING_KINDS: readonly string[] = [priceTrigger.kind];
