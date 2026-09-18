/**
 * The last questions asked before a signature.
 *
 * Everything else in Maschina can be wrong and recoverable. This cannot: past this point a transaction
 * is signed, and a signed transaction is final. So these checks assume nothing upstream did its job.
 * The orchestrator has already decided a trade is a good idea, the router has already priced it, and
 * neither of those opinions is evidence that the owner allowed it.
 *
 * Three principles decide how each rule behaves:
 *
 *   - **An absent limit is not permission.** A machine with no approved tokens may trade none of them.
 *   - **Refusing is normal, pausing is not.** A daily cap being reached is the system working, and it
 *     resets tomorrow. A trade larger than the per-trade cap means something upstream is wrong or
 *     tampered with, and the machine stops until a person looks.
 *   - **Order matters.** The cheapest and most fundamental question is asked first, so a stopped machine
 *     is never assessed on its budget, and no rule is ever judged on numbers that should not exist.
 */

import { type BaseUnits, baseUnitsOf } from "@maschina/core";

export const TRADE_RULES = [
	"machine_running",
	"run_due",
	"token_approved",
	"per_trade_cap",
	"daily_cap",
	"budget",
] as const;

export type TradeRule = (typeof TRADE_RULES)[number];

/** Why a machine was paused, using the record's own words. */
export type PauseReason = "budget_exhausted" | "other";

export type TradeDecision =
	| { allowed: true }
	| {
			allowed: false;
			rule: TradeRule;
			reason: string;
			/**
			 * Set when the machine should stop until a person looks. Absent means the refusal is a normal
			 * part of running: the trade does not happen, the machine carries on.
			 */
			pause?: PauseReason;
	  };

export type TradeLimits = {
	maxPerTrade?: BaseUnits | undefined;
	maxPerDay?: BaseUnits | undefined;
	approvedMints: readonly string[];
};

export type TradeCheck = {
	/** The machine's state, read from the record a moment ago, not from anything in flight. */
	state: string;
	limits: TradeLimits;
	/** Granted minus reserved minus settled: what is left to spend. */
	availableBudget: BaseUnits;
	/** What has actually left the wallet since the day began. */
	spentToday: BaseUnits;
	trade: {
		inputMint: string;
		outputMint: string;
		inputAmount: BaseUnits;
	};
	run: {
		/** The moment this run was for, which is not when the code happens to be running. */
		dueAt: Date;
	};
	now: Date;
	/**
	 * How long after its moment a run may still act. A run that arrives late has been waiting somewhere,
	 * and the price it was quoted against has moved.
	 */
	graceMs?: number;
	/** How far ahead of its moment a run may act, to allow for clocks that disagree slightly. */
	earlyMs?: number;
};

const DEFAULT_GRACE_MS = 60 * 60 * 1000;
const DEFAULT_EARLY_MS = 30 * 1000;

const refuse = (rule: TradeRule, reason: string, pause?: PauseReason): TradeDecision =>
	pause ? { allowed: false, rule, reason, pause } : { allowed: false, rule, reason };

/** Every rule, in order, with the first failure winning. */
export function checkTrade(check: TradeCheck): TradeDecision {
	const { limits, trade, run, now } = check;

	// 1. Is this machine allowed to act at all? Read from the record, not from what anyone claims.
	if (check.state !== "running") {
		return refuse("machine_running", `the machine is ${check.state}, not running`);
	}

	// 2. Is this run the one it says it is? A run acting outside its window is a scheduling fault, and
	// the price it was quoted against belongs to a different moment.
	const graceMs = check.graceMs ?? DEFAULT_GRACE_MS;
	const earlyMs = check.earlyMs ?? DEFAULT_EARLY_MS;
	const lateBy = now.getTime() - run.dueAt.getTime();
	if (lateBy > graceMs) {
		return refuse(
			"run_due",
			`this run was due ${Math.round(lateBy / 60_000)} minutes ago, past its grace period`,
		);
	}
	if (lateBy < -earlyMs) {
		return refuse(
			"run_due",
			`this run is not due for another ${Math.round(-lateBy / 1000)} seconds`,
			"other",
		);
	}

	// 3. Are both tokens ones the owner approved? An empty list approves nothing.
	for (const mint of [trade.inputMint, trade.outputMint]) {
		if (!limits.approvedMints.includes(mint)) {
			return refuse("token_approved", `${mint} is not an approved token`, "other");
		}
	}

	// 4. Is this one trade within what the owner allowed for one trade?
	if (limits.maxPerTrade !== undefined && trade.inputAmount > limits.maxPerTrade) {
		return refuse(
			"per_trade_cap",
			`this trade spends ${trade.inputAmount}, and one trade may spend ${limits.maxPerTrade}`,
			"other",
		);
	}

	// 5. Would today's spending pass the daily cap? Normal, and it resets tomorrow.
	if (limits.maxPerDay !== undefined) {
		const afterwards = baseUnitsOf(check.spentToday + trade.inputAmount);
		if (afterwards > limits.maxPerDay) {
			return refuse(
				"daily_cap",
				`today's spending would reach ${afterwards}, and the daily cap is ${limits.maxPerDay}`,
			);
		}
	}

	// 6. Is there budget left? This is the one that means the machine has nothing more to work with.
	if (trade.inputAmount > check.availableBudget) {
		return refuse(
			"budget",
			`this trade spends ${trade.inputAmount}, and ${check.availableBudget} is left`,
			"budget_exhausted",
		);
	}

	return { allowed: true };
}
