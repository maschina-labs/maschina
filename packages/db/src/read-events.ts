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

/**
 * The events behind an owner's public record: every machine they own, live or paper, running or
 * stopped (D-108).
 *
 * Bounded in SQL rather than in the application. Reading a whole history to show the last few trades
 * is how a public page becomes a way to make the database work hard, and the public page is the one
 * anybody can ask for as often as they like.
 *
 * It takes two passes on purpose. The first finds the most recent finished trades, so the limit is
 * applied to trades rather than to rows; the second fetches only the intents those trades need to say
 * which way they went. A single limited query would cut intents away from their completions and
 * silently drop trades from the record.
 */
export async function readOwnerPublicEvents(
	db: Executor,
	ownerId: string,
	limit: number,
): Promise<StoredEvent[]> {
	const finished = await db.execute<EventRow>(sql`
		select e.id, e.machine_id, e.type, e.payload, e.occurred_at from events e
		join machines m on m.id = e.machine_id
		where m.owner_id = ${ownerId}::uuid
			and e.type in ('trade.completed', 'trade.simulated')
		order by e.occurred_at desc, e.id desc
		limit ${limit * 2}`);

	const tradeIds = finished
		.map((row) => (row.payload as Record<string, unknown> | null)?.["tradeId"])
		.filter((id): id is string => typeof id === "string");

	// Only the intents belonging to those trades, so this stays bounded by the limit above.
	//
	// Written as `in (...)` with one placeholder per id, not `= any(${tradeIds}::text[])`: the sql tag
	// expands an array into a list of placeholders, so that cast asks Postgres to turn a record into
	// an array and it refuses. It failed for every owner who had finished a trade (MISTAKES M48).
	const intents =
		tradeIds.length === 0
			? []
			: await db.execute<EventRow>(sql`
					select e.id, e.machine_id, e.type, e.payload, e.occurred_at from events e
					join machines m on m.id = e.machine_id
					where m.owner_id = ${ownerId}::uuid
						and e.type = 'trade.intended'
						and e.payload->>'tradeId' in (${sql.join(
							tradeIds.map((id) => sql`${id}`),
							sql`, `,
						)})`);

	// Oldest first, the order the projection reads in: an intent has to arrive before its completion.
	return [...intents, ...finished]
		.map(
			(row) =>
				({
					id: row.id,
					machineId: row.machine_id,
					type: row.type,
					payload: row.payload,
					occurredAt: new Date(row.occurred_at),
				}) as StoredEvent,
		)
		.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
