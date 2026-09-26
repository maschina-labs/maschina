/**
 * The machine kinds this node can run.
 *
 * A node only runs kinds it knows, and leaves the rest for a node that does. That is what makes it
 * possible to add a kind without updating every node at once. The risk is the other way around: a kind
 * something queues work for, that no node can run, is a machine that waits forever. The test beside
 * this file holds that line.
 */

import { type MachineKind, priceTrigger, range, recurringBuy, registryOf } from "@maschina/runtime";

export const NODE_KINDS = registryOf([
	recurringBuy as MachineKind<never>,
	priceTrigger as MachineKind<never>,
	range as MachineKind<never>,
]);
