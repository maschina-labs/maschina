/**
 * The recurring buy: spend a fixed amount on a schedule until a total is reached.
 *
 * The plainest machine there is, and the one most people want: put $25 into SOL every Monday, stop after
 * $500. It decides nothing about price and never tries to be clever, which is the point. Whether it is
 * due is the scheduler's job; by the time this is asked, a run exists because something was due.
 *
 * It refuses rather than improvises. Not enough money, budget gone, or the total reached all produce a
 * plain reason that ends up in the record, so an owner can always see why nothing happened.
 */

import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import type { Decision, MachineKind, MachineView } from "../machine-kind.ts";

export type RecurringBuySettings = {
	/** What is being spent, usually a stablecoin. */
	spendMint: string;
	/** What is being bought. */
	buyMint: string;
	/** How much to spend each time, in the spend token's smallest unit. */
	amountPerBuy: BaseUnits;
	/** Stop once this much has been spent in total. Absent means keep going until stopped. */
	stopAfterTotal?: BaseUnits;
	/** How far the price may move before the trade is refused. */
	slippageBps: number;
};

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function readAmount(value: unknown): BaseUnits | undefined {
	if (typeof value === "bigint") return value >= 0n ? baseUnitsOf(value) : undefined;
	if (typeof value === "string" && /^\d+$/.test(value)) return baseUnitsOf(BigInt(value));
	return undefined;
}

export const recurringBuy: MachineKind<RecurringBuySettings> = {
	kind: "recurring_buy",

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
		const amountPerBuy = readAmount(raw["amountPerBuy"]);
		if (amountPerBuy === undefined || amountPerBuy === 0n) {
			return { ok: false, problem: "amountPerBuy must be a whole amount above zero" };
		}
		const stopAfterTotal =
			raw["stopAfterTotal"] === undefined ? undefined : readAmount(raw["stopAfterTotal"]);
		if (raw["stopAfterTotal"] !== undefined && stopAfterTotal === undefined) {
			return { ok: false, problem: "stopAfterTotal must be a whole amount" };
		}
		if (stopAfterTotal !== undefined && stopAfterTotal < amountPerBuy) {
			return { ok: false, problem: "stopAfterTotal is less than one buy" };
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
		return {
			ok: true,
			value: {
				spendMint,
				buyMint,
				amountPerBuy,
				slippageBps,
				...(stopAfterTotal === undefined ? {} : { stopAfterTotal }),
			},
		};
	},

	/** What it spends is what its budget is counted in. */
	budgetMint(settings) {
		return settings.spendMint;
	},

	decide(settings, view: MachineView): Decision {
		const { amountPerBuy, stopAfterTotal } = settings;

		if (stopAfterTotal !== undefined) {
			const remaining = stopAfterTotal - view.totals.spent;
			if (remaining <= 0n) {
				return { decide: "stop", because: "the total this machine was set to spend is reached" };
			}
			if (remaining < amountPerBuy) {
				return {
					decide: "stop",
					because: "what is left of the total is less than one buy, so this was the last one",
				};
			}
		}

		if (view.availableBudget < amountPerBuy) {
			return {
				decide: "wait",
				because: "budget_exhausted",
				detail: `a buy needs ${amountPerBuy}, and ${view.availableBudget} is left in the budget`,
			};
		}

		const balance = view.balances.get(settings.spendMint) ?? baseUnitsOf(0n);
		if (balance < amountPerBuy) {
			return {
				decide: "wait",
				because: "balance_too_low",
				detail: `a buy needs ${amountPerBuy}, and the wallet holds ${balance}`,
			};
		}

		return {
			decide: "act",
			because: "the machine is due and can afford its next buy",
			action: {
				do: "swap",
				inputMint: settings.spendMint,
				outputMint: settings.buyMint,
				inputAmount: amountPerBuy,
				slippageBps: settings.slippageBps,
			},
		};
	},
};
