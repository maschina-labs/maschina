/**
 * Turning what the record holds into what the API says.
 *
 * Amounts are whole numbers too large for JSON, so they cross as digits. Times cross as ISO strings.
 * Nothing else changes: the API's shapes are the record's, spelled for the wire.
 */

import type { OwnedMachine, OwnedMachineDetail, StoredEvent } from "@maschina/db";

const digits = (value: bigint) => value.toString();

export const asSummary = (machine: OwnedMachine) => ({
	machineId: machine.machineId,
	name: machine.name,
	kind: machine.kind,
	walletAddress: machine.walletAddress,
	createdAt: machine.createdAt.toISOString(),
	state: machine.state,
	...(machine.stateReason === undefined ? {} : { stateReason: machine.stateReason }),
	budget: {
		granted: digits(machine.budget.granted),
		reserved: digits(machine.budget.reserved),
		settled: digits(machine.budget.settled),
		available: digits(machine.budget.available),
	},
});

export const asDetail = (machine: OwnedMachineDetail) => ({
	...asSummary(machine),
	settings: machine.settings,
	limits: {
		...(machine.limits.maxPerTrade === undefined
			? {}
			: { maxPerTrade: digits(machine.limits.maxPerTrade) }),
		...(machine.limits.maxPerDay === undefined
			? {}
			: { maxPerDay: digits(machine.limits.maxPerDay) }),
		approvedMints: machine.limits.approvedMints,
	},
	actions: machine.actions,
});

/** The record, newest first, cut to what was asked for. */
export const asRecord = (events: StoredEvent[], limit: number) =>
	events
		.slice(-limit)
		.reverse()
		.map((event) => ({
			id: event.id,
			type: event.type,
			occurredAt: event.occurredAt.toISOString(),
			payload: event.payload,
		}));
