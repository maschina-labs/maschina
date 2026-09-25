/**
 * A machine's budget, worked out from its events.
 *
 * Like the machine's state, the budget is never stored as a fact of its own. It is three numbers
 * (granted, reserved, settled) rebuilt from what the machine actually did, so a crash between
 * reserving and settling can never leave a balance that quietly disagrees with the record.
 *
 * How events move the numbers:
 *
 *   machine.limits_changed (budgetGranted)  sets granted to what the owner allowed
 *   trade.intended                          reserves what the trade could cost
 *   trade.completed                         settles what it really cost, releasing the rest
 *   trade.failed, trade.refused             releases the reservation: nothing was spent
 *
 * Told which currency the budget is held in, it also reads the other direction. A trade that sells back
 * into that currency returns what it brought home, and a trade that spends something else holds nothing
 * against the budget at all. Without that, a machine that buys and sells the same pair spends its grant
 * down to nothing however well it trades, because only one side of each round trip was ever counted.
 *
 * A trade is reserved once, by its trade id. A repeated event for the same trade changes nothing,
 * because the record may be read again from the beginning at any time and must give the same answer.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import {
	available,
	type Budget,
	createBudget,
	credit,
	release,
	reserve,
	settle,
} from "@maschina/rules";

export type MachineBudget = Budget & {
	/** Granted minus reserved minus settled: what the machine may still spend. */
	available: BaseUnits;
	/** Trades that reserved budget and haven't finished. */
	openTrades: number;
};

const amount = (value: string): BaseUnits => baseUnitsOf(BigInt(value));

export type BudgetOptions = {
	/**
	 * The currency the budget is counted in, which is whatever the machine spends. Left out, the budget
	 * only ever falls, which is correct for a machine that buys and never sells.
	 */
	budgetMint?: string | undefined;
};

/** What an unfinished trade holds, and which way it runs, so it settles or credits exactly once. */
type OpenTrade = { reserved: BaseUnits; inputMint: string; outputMint: string };

export function machineBudget(
	events: Iterable<RecordedEvent>,
	options: BudgetOptions = {},
): MachineBudget {
	const { budgetMint } = options;
	let budget = createBudget(baseUnitsOf(0n));
	const held = new Map<string, OpenTrade>();

	for (const event of events) {
		switch (event.type) {
			case "machine.limits_changed": {
				if (event.payload.limit !== "budgetGranted") break;
				const granted = amount(event.payload.to);
				// The owner may raise or lower the grant, but never below what is already committed.
				const committed = baseUnitsOf(budget.reserved + budget.settled);
				budget = { ...budget, granted: granted < committed ? committed : granted };
				break;
			}
			case "trade.intended": {
				const { tradeId, inputMint, outputMint, inputAmount, feeAllowance } = event.payload;
				if (held.has(tradeId)) break;
				// Selling something the budget is not counted in costs the budget nothing to attempt.
				const spendsBudget = budgetMint === undefined || inputMint === budgetMint;
				// The most this trade could cost: what it spends, plus what it costs to send.
				const wanted = spendsBudget
					? baseUnitsOf(BigInt(inputAmount) + BigInt(feeAllowance ?? "0"))
					: baseUnitsOf(0n);
				// A trade that doesn't fit is refused elsewhere; here it simply reserves nothing.
				if (wanted > available(budget)) break;
				if (wanted > 0n) budget = reserve(budget, wanted);
				held.set(tradeId, { reserved: wanted, inputMint, outputMint });
				break;
			}
			case "trade.completed": {
				const { tradeId, inputAmount, outputAmount, feeLamports } = event.payload;
				const open = held.get(tradeId);
				if (open === undefined) break;
				if (open.reserved > 0n) {
					const spent = baseUnitsOf(BigInt(inputAmount) + BigInt(feeLamports));
					// Costing more than was reserved is a bug in the estimate, so settle what was held.
					budget = settle(budget, open.reserved, spent > open.reserved ? open.reserved : spent);
				}
				// Money that came back in the budget's own currency is the owner's money again.
				if (budgetMint !== undefined && open.outputMint === budgetMint) {
					budget = credit(budget, baseUnitsOf(BigInt(outputAmount)));
				}
				held.delete(tradeId);
				break;
			}
			case "trade.failed":
			case "trade.refused": {
				const open = held.get(event.payload.tradeId);
				if (open === undefined) break;
				if (open.reserved > 0n) budget = release(budget, open.reserved);
				held.delete(event.payload.tradeId);
				break;
			}
			default:
				break;
		}
	}

	return { ...budget, available: available(budget), openTrades: held.size };
}

/** True when the machine could still pay for something costing this much. */
export const canAfford = (budget: MachineBudget, cost: BaseUnits): boolean =>
	cost <= budget.available;
