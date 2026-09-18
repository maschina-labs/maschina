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
 * A trade is reserved once, by its trade id. A repeated event for the same trade changes nothing,
 * because the record may be read again from the beginning at any time and must give the same answer.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import { available, type Budget, createBudget, release, reserve, settle } from "@maschina/rules";

export type MachineBudget = Budget & {
	/** Granted minus reserved minus settled: what the machine may still spend. */
	available: BaseUnits;
	/** Trades that reserved budget and haven't finished. */
	openTrades: number;
};

const amount = (value: string): BaseUnits => baseUnitsOf(BigInt(value));

export function machineBudget(events: Iterable<RecordedEvent>): MachineBudget {
	let budget = createBudget(baseUnitsOf(0n));
	/** What each unfinished trade is holding, so it can be settled or released exactly once. */
	const held = new Map<string, BaseUnits>();

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
				const { tradeId, inputAmount } = event.payload;
				if (held.has(tradeId)) break;
				const wanted = amount(inputAmount);
				// A trade that doesn't fit is refused elsewhere; here it simply reserves nothing.
				if (wanted > available(budget)) break;
				budget = reserve(budget, wanted);
				held.set(tradeId, wanted);
				break;
			}
			case "trade.completed": {
				const { tradeId, inputAmount, feeLamports } = event.payload;
				const reserved = held.get(tradeId);
				if (reserved === undefined) break;
				const spent = baseUnitsOf(BigInt(inputAmount) + BigInt(feeLamports));
				// Costing more than was reserved is a bug in the estimate, so settle what was held.
				budget = settle(budget, reserved, spent > reserved ? reserved : spent);
				held.delete(tradeId);
				break;
			}
			case "trade.failed":
			case "trade.refused": {
				const reserved = held.get(event.payload.tradeId);
				if (reserved === undefined) break;
				budget = release(budget, reserved);
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
