/**
 * The limits an owner set, worked out from the record.
 *
 * Like state and budget, limits are never stored as a separate fact. The owner changing a limit is an
 * event, and the current limit is whatever the last such event said. That way there is exactly one
 * answer to "what was this machine allowed to do at the moment it acted", and it can still be answered
 * a year later.
 *
 * Every limit arrives as text, because that is how the record stores all of them. Anything unreadable is
 * treated as though the limit was never set, and a limit that was never set is not permission: the
 * signer refuses a trade whose tokens are not on the approved list, and an absent cap is only absent,
 * never infinite in the direction that spends money.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf } from "@maschina/core";

export type MachineLimits = {
	/** The most one trade may spend. */
	maxPerTrade?: BaseUnits;
	/** The most a machine may spend in a day. */
	maxPerDay?: BaseUnits;
	/** The tokens this machine may trade. Empty means none, not all. */
	approvedMints: string[];
	/** Addresses a machine may send to, for kinds that send rather than trade. Empty means none. */
	recipients: string[];
};

/** A list of addresses as the record stores it: comma separated, in one text field. */
export function parseList(value: string): string[] {
	const seen = new Set<string>();
	for (const entry of value.split(",")) {
		const trimmed = entry.trim();
		if (trimmed) seen.add(trimmed);
	}
	return [...seen];
}

/** An amount as the record stores it, or nothing when the text is not a whole number. */
function parseAmount(value: string): BaseUnits | undefined {
	if (!/^\d+$/.test(value)) return undefined;
	return baseUnitsOf(BigInt(value));
}

export function machineLimits(events: Iterable<RecordedEvent>): MachineLimits {
	const limits: MachineLimits = { approvedMints: [], recipients: [] };

	for (const event of events) {
		if (event.type !== "machine.limits_changed") continue;
		const { limit, to } = event.payload;

		switch (limit) {
			case "maxPerTrade": {
				const amount = parseAmount(to);
				if (amount === undefined) delete limits.maxPerTrade;
				else limits.maxPerTrade = amount;
				break;
			}
			case "maxPerDay": {
				const amount = parseAmount(to);
				if (amount === undefined) delete limits.maxPerDay;
				else limits.maxPerDay = amount;
				break;
			}
			case "approvedMints":
				limits.approvedMints = parseList(to);
				break;
			case "recipients":
				limits.recipients = parseList(to);
				break;
			// The budget is a number of its own, worked out by `machineBudget`, not a limit read here.
			case "budgetGranted":
				break;
		}
	}

	return limits;
}

/** An event with the moment the record accepted it, which is how "today" is judged. */
export type TimedEvent = RecordedEvent & { occurredAt: Date };

/**
 * What a machine has actually spent since a moment, from the record.
 *
 * Only completed trades count. A trade that is still open has money reserved, not spent, and a trade
 * that failed spent nothing. Reservations are the budget's job; this answers "how much has left the
 * wallet today", which is what a daily cap is about.
 */
export function settledSince(events: Iterable<TimedEvent>, since: Date): BaseUnits {
	const from = since.getTime();
	let total = 0n;

	for (const event of events) {
		if (event.type !== "trade.completed") continue;
		if (event.occurredAt.getTime() < from) continue;
		total += BigInt(event.payload.inputAmount);
	}

	return baseUnitsOf(total);
}
