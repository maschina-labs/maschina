/**
 * A budget is three numbers, never one.
 *
 *   granted   what the owner allowed in total
 *   reserved  held for actions that are about to happen, cost not yet known
 *   settled   actually spent
 *
 * Available is granted minus reserved minus settled. Holding one running balance instead loses track
 * of reservations when something crashes between reserving and settling, and double-counts when
 * budget is handed to another machine.
 */

import { type BaseUnits, baseUnitsOf, MaschinaError } from "@maschina/core";

export type Budget = Readonly<{
	granted: BaseUnits;
	reserved: BaseUnits;
	settled: BaseUnits;
}>;

export function createBudget(granted: BaseUnits): Budget {
	return { granted, reserved: baseUnitsOf(0n), settled: baseUnitsOf(0n) };
}

export function available(budget: Budget): BaseUnits {
	return baseUnitsOf(budget.granted - budget.reserved - budget.settled);
}

/** Holds the most an action could cost. Refuses if it doesn't fit, so the action never starts. */
export function reserve(budget: Budget, amount: BaseUnits): Budget {
	if (amount > available(budget)) {
		throw new MaschinaError("limit_exceeded", "the budget cannot cover this action", {
			details: { requested: amount.toString(), available: available(budget).toString() },
		});
	}
	return { ...budget, reserved: baseUnitsOf(budget.reserved + amount) };
}

/**
 * Replaces a reservation with what the action really cost. The real cost can never exceed what was
 * reserved: an action that costs more than its reservation is a bug in the estimate, and is refused
 * rather than quietly overspending.
 */
export function settle(budget: Budget, reservedAmount: BaseUnits, actualCost: BaseUnits): Budget {
	assertHeld(budget, reservedAmount);
	if (actualCost > reservedAmount) {
		throw new MaschinaError("limit_exceeded", "an action cost more than was reserved for it", {
			details: { reserved: reservedAmount.toString(), actual: actualCost.toString() },
		});
	}
	return {
		...budget,
		reserved: baseUnitsOf(budget.reserved - reservedAmount),
		settled: baseUnitsOf(budget.settled + actualCost),
	};
}

/**
 * Returns money to the budget, for an action that brought it back.
 *
 * A machine that sells into the currency its budget is held in is holding the owner's money again, so
 * the grant is a limit on what may be deployed at once rather than a total that can only ever be spent
 * down. Settled never falls below zero: a machine that earns more than it spent has made a profit,
 * which belongs to its owner, and not a wider mandate than the owner agreed to.
 */
export function credit(budget: Budget, amount: BaseUnits): Budget {
	const settled = budget.settled - amount;
	return { ...budget, settled: baseUnitsOf(settled < 0n ? 0n : settled) };
}

/** Returns a reservation untouched, for an action that never happened. */
export function release(budget: Budget, reservedAmount: BaseUnits): Budget {
	assertHeld(budget, reservedAmount);
	return { ...budget, reserved: baseUnitsOf(budget.reserved - reservedAmount) };
}

function assertHeld(budget: Budget, amount: BaseUnits): void {
	if (amount > budget.reserved) {
		throw new MaschinaError("conflict", "releasing more than is reserved", {
			details: { reserved: budget.reserved.toString(), requested: amount.toString() },
		});
	}
}
