/**
 * Alerts: the events in the record worth telling an owner about, and which of them have been told.
 *
 * What is worth telling is the same short list the app's bell uses: trades, failures, refusals, money
 * coming home or being banked, and a machine stopping or pausing itself. An owner pausing their own
 * machine is not news to them, so that is left out. Routine runs that did nothing are never an alert:
 * an alert that fires all the time is one people learn to ignore.
 */

import type { AlertChannel } from "@maschina/contracts";
import { budgetMintOf, KNOWN_KINDS, machinePnl } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";

const WORTH_TELLING = [
	"trade.completed",
	"trade.failed",
	"trade.refused",
	"machine.paused",
	"machine.stopped",
	"withdrawal.completed",
	"withdrawal.failed",
	"sweep.completed",
];

export type PendingAlert = {
	eventId: string;
	ownerId: string;
	machineId: string;
	machineName: string;
	type: string;
	occurredAt: Date;
	trade?: { inputMint: string; outputMint: string; inputAmount: bigint; outputAmount: bigint };
	realised?: bigint;
	reason?: string;
};

type Row = {
	id: string;
	machine_id: string;
	type: string;
	payload: Record<string, unknown>;
	occurred_at: string | Date;
	owner_id: string;
	name: string;
	kind: string;
	settings: unknown;
};

const text = (value: unknown) =>
	typeof value === "string" && value.length > 0 ? value : undefined;

/** What these owners have not yet been told on this channel, since a moment, oldest first. */
export async function pendingAlerts(
	db: Executor,
	ask: { channel: AlertChannel; ownerIds: readonly string[]; since: Date; limit?: number },
): Promise<PendingAlert[]> {
	if (ask.ownerIds.length === 0) return [];
	const rows = await db.execute<Row>(sql`
		select events.id, events.machine_id, events.type, events.payload, events.occurred_at,
			machines.owner_id, machines.name, machine_definitions.kind, machine_definitions.settings
		from events
		join machines on machines.id = events.machine_id
		join machine_definitions on machine_definitions.id = machines.definition_id
		where machines.owner_id in (${sql.join(
			ask.ownerIds.map((owner) => sql`${owner}::uuid`),
			sql`, `,
		)})
			and events.type in (${sql.join(
				WORTH_TELLING.map((type) => sql`${type}`),
				sql`, `,
			)})
			and events.occurred_at > ${ask.since.toISOString()}::timestamptz
			and not exists (
				select 1 from deliveries
				where deliveries.event_id = events.id and deliveries.channel = ${ask.channel}
			)
		order by events.occurred_at, events.id
		limit ${ask.limit ?? 50}`);

	const alerts: PendingAlert[] = [];
	for (const row of rows) {
		// Pausing your own machine is not news to you.
		if (row.type === "machine.paused" && row.payload["reason"] === "owner") continue;
		if (row.type === "machine.stopped" && row.payload["by"] === "owner") continue;

		const alert: PendingAlert = {
			eventId: row.id,
			ownerId: row.owner_id,
			machineId: row.machine_id,
			machineName: row.name,
			type: row.type,
			occurredAt: row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at),
		};
		const reason = text(row.payload["detail"]) ?? text(row.payload["reason"]);
		if (reason !== undefined && row.type !== "trade.completed") alert.reason = reason;

		if (row.type === "trade.completed") {
			// Which way a trade went is in its intent, and what it has realised is in the whole record, so
			// the record is read for a trade. Trades are rare enough that this costs nothing.
			const events = await readMachineEvents(db, row.machine_id);
			const upTo = events.slice(0, events.findIndex((event) => event.id === row.id) + 1);
			const intent = upTo.find(
				(event) =>
					event.type === "trade.intended" && event.payload.tradeId === row.payload["tradeId"],
			);
			if (intent?.type === "trade.intended") {
				alert.trade = {
					inputMint: intent.payload.inputMint,
					outputMint: intent.payload.outputMint,
					inputAmount: BigInt(String(row.payload["inputAmount"])),
					outputAmount: BigInt(String(row.payload["outputAmount"])),
				};
			}
			const budgetMint = budgetMintOf(KNOWN_KINDS, row.kind, row.settings);
			if (budgetMint !== undefined) alert.realised = machinePnl(upTo, { budgetMint }).realised;
		}
		alerts.push(alert);
	}
	return alerts;
}

/** Records that an alert went out. Saying so twice is harmless. */
export async function markDelivered(
	db: Executor,
	delivered: { eventId: string; channel: AlertChannel },
): Promise<void> {
	await db.execute(sql`
		insert into deliveries (event_id, channel)
		values (${delivered.eventId}::uuid, ${delivered.channel})
		on conflict do nothing`);
}
