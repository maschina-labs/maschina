/**
 * The only way anything is written to the permanent record.
 *
 * Two things have to be true of every event, and both are enforced here so they can't be forgotten:
 *
 * 1. **The payload matches its event type**, checked against the contracts. The record is append only,
 *    so an event written wrong can never be corrected.
 * 2. **The writer's lease is current.** A node that was cut off, and whose run was given to another
 *    node, must not be able to append afterwards. Its lease epoch is older than the one already in the
 *    record, and the write is refused.
 *
 * The epoch check and the insert are one statement, so two nodes racing can't both pass the check.
 * An architecture rule keeps every other file from inserting into `events` directly.
 */

import { parseEvent } from "@maschina/contracts";
import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";

export type EventToAppend = {
	machineId: string;
	type: string;
	payload: unknown;
	/** The epoch of the lease the writer holds. */
	leaseEpoch: bigint;
};

export type AppendedEvent = { id: string; occurredAt: Date };

export type AppendResult = Result<AppendedEvent, MaschinaError>;

export async function appendEvent(db: Database, event: EventToAppend): Promise<AppendResult> {
	const checked = parseEvent(event);
	if (!checked.ok) {
		return err(
			new MaschinaError("invalid_input", "the event doesn't match its type", {
				details: { type: event.type, problems: checked.error.issues.map((issue) => issue.path) },
			}),
		);
	}
	if (event.leaseEpoch < 0n) {
		return err(new MaschinaError("invalid_input", "a lease epoch is never negative"));
	}

	const id = newId<"event">();
	// The driver hands back whatever the column serialises to, so the time is converted here.
	const rows = await db.execute<{ id: string; occurred_at: string | Date }>(sql`
		insert into events (id, machine_id, type, payload, lease_epoch)
		select ${id}::uuid, ${checked.value.machineId}::uuid, ${checked.value.type},
			${JSON.stringify(checked.value.payload)}::jsonb, ${event.leaseEpoch.toString()}::bigint
		where not exists (
			select 1 from events
			where machine_id = ${checked.value.machineId}::uuid
				and lease_epoch > ${event.leaseEpoch.toString()}::bigint
		)
		returning id, occurred_at`);

	const written = rows[0];
	if (!written) {
		return err(
			new MaschinaError("conflict", "a newer lease has written for this machine", {
				details: { machineId: event.machineId, leaseEpoch: event.leaseEpoch.toString() },
			}),
		);
	}
	return ok({ id: written.id, occurredAt: new Date(written.occurred_at) });
}
