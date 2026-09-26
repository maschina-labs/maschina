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
import { recurringBuy } from "./recurring-buy.ts";

export const KNOWN_KINDS = registryOf([
	recurringBuy as MachineKind<never>,
	priceTrigger as MachineKind<never>,
]);
