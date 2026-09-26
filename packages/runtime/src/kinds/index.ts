/**
 * Every machine kind that exists.
 *
 * A node runs a subset of these, deliberately, so a kind can be added without updating every node at
 * once. Accounting is different: reading what a machine did has to understand every kind, or the
 * numbers come out wrong for the ones it does not know.
 */

import type { MachineKind } from "../machine-kind.ts";
import { registryOf } from "../machine-kind.ts";
import { priceTrigger } from "./price-trigger.ts";
import { range } from "./range.ts";
import { recurringBuy } from "./recurring-buy.ts";

export const KNOWN_KINDS = registryOf([
	recurringBuy as MachineKind<never>,
	priceTrigger as MachineKind<never>,
	range as MachineKind<never>,
]);

/**
 * The kinds that wait for a price rather than a schedule.
 *
 * Worked out from the registry rather than listed by hand: a kind that declares levels is a kind that
 * has to be watched, and anything that follows prices reads this. A list kept by hand is a list that
 * eventually forgets a kind, and a kind nothing watches is a machine that waits forever.
 */
export const PRICE_WATCHING_KINDS: readonly string[] = [...KNOWN_KINDS.values()]
	.filter((kind) => kind.levels !== undefined)
	.map((kind) => kind.kind);
