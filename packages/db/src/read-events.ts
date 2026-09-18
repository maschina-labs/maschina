/**
 * Reading a machine's record back.
 *
 * Everything a machine is, its state, its budget, its limits, is worked out from these rows in the order
 * they were written. So the order has to be exact: by the moment the record accepted them, and by id
 * where two share a moment, because ids are time ordered and never tie.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

/** An event as the record holds it, with the moment it was accepted. */
export type StoredEvent = RecordedEvent & { id: string; occurredAt: Date };

type EventRow = {
	id: string;
	machine_id: string;
	type: string;
	payload: unknown;
	occurred_at: string | Date;
};

/** Every event for one machine, oldest first. */
export async function readMachineEvents(
	db: Executor,
	machineId: string,
	options: { since?: Date } = {},
): Promise<StoredEvent[]> {
	const rows = options.since
		? await db.execute<EventRow>(sql`
				select id, machine_id, type, payload, occurred_at from events
				where machine_id = ${machineId}::uuid and occurred_at >= ${options.since.toISOString()}::timestamptz
				order by occurred_at, id`)
		: await db.execute<EventRow>(sql`
				select id, machine_id, type, payload, occurred_at from events
				where machine_id = ${machineId}::uuid
				order by occurred_at, id`);

	return rows.map(
		(row) =>
			({
				id: row.id,
				machineId: row.machine_id,
				type: row.type,
				payload: row.payload,
				occurredAt: new Date(row.occurred_at),
			}) as StoredEvent,
	);
}
