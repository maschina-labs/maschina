/**
 * The event log. 02-CORE §7.
 *
 * Two operations exist: append and read. There is no update, no delete, and no
 * upsert, and there never will be. 02-CORE §3.5 makes that a property of the
 * primitive rather than a policy of this module. The database enforces it
 * independently (see schema.sql), so this file being correct is not the only
 * thing standing between us and a mutable log.
 */

import type { Event, NewEvent, ReadOptions } from "@maschina/core";
import type { Pool } from "pg";

interface EventRow {
	id: bigint;
	recorded_at: Date;
	actor: string;
	objective: string | null;
	type: string;
	payload: Record<string, unknown>;
	epoch: bigint;
	causation: bigint | null;
}

function toEvent(row: EventRow): Event {
	return {
		id: row.id,
		recordedAt: row.recorded_at,
		actor: row.actor,
		objective: row.objective,
		type: row.type,
		payload: row.payload,
		epoch: row.epoch,
		causation: row.causation,
	};
}

/**
 * Payload schema version. ADR-006.
 *
 * Every payload written by any module carries `v`. A reader handles every
 * version it has ever seen, because an event written in the wrong shape is
 * written in the wrong shape permanently: the log is append-only and there is no
 * migration path.
 *
 * Bump only for a change a reader cannot handle by ignoring it. Adding an
 * optional field is not a new version.
 *
 * Lives here rather than beside any one primitive because it is a fact about the
 * log, and every module that appends needs it.
 */
export const PAYLOAD_V = 1;

const COLUMNS = "id, recorded_at, actor, objective, type, payload, epoch, causation";

/**
 * Append one event. Returns it as recorded, including the id and timestamp the
 * log assigned.
 *
 * The caller cannot supply an id: the column is GENERATED ALWAYS AS IDENTITY,
 * so ordering is the log's to decide and cannot be forged by a caller.
 */
export async function append(pool: Pool, event: NewEvent): Promise<Event> {
	const result = await pool.query<EventRow>(
		`INSERT INTO events (actor, objective, type, payload, epoch, causation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
		[
			event.actor,
			event.objective ?? null,
			event.type,
			JSON.stringify(event.payload ?? {}),
			(event.epoch ?? 0n).toString(),
			event.causation?.toString() ?? null,
		],
	);

	const row = result.rows[0];
	if (!row) {
		// Unreachable: INSERT ... RETURNING always yields a row or throws. Treated
		// as an error rather than assumed away, per 01-PRINCIPLES P8. An append
		// whose outcome we cannot determine must not look like a success.
		throw new Error("append: INSERT returned no row");
	}
	return toEvent(row);
}

/**
 * Read the log in order.
 *
 * Ordering is by id ascending, which is the total order the log assigns. Time
 * is recorded but is never the sort key: clocks move and ids do not.
 */
export async function read(pool: Pool, options: ReadOptions = {}): Promise<Event[]> {
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (options.objective !== undefined) {
		params.push(options.objective);
		conditions.push(`objective = $${params.length}`);
	}
	if (options.actor !== undefined) {
		params.push(options.actor);
		conditions.push(`actor = $${params.length}`);
	}
	if (options.after !== undefined) {
		params.push(options.after.toString());
		conditions.push(`id > $${params.length}`);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	let limit = "";
	if (options.limit !== undefined) {
		params.push(options.limit);
		limit = `LIMIT $${params.length}`;
	}

	const result = await pool.query<EventRow>(
		`SELECT ${COLUMNS} FROM events ${where} ORDER BY id ASC ${limit}`,
		params,
	);
	return result.rows.map(toEvent);
}

/** The highest id in the log, or null if the log is empty. */
export async function head(pool: Pool): Promise<bigint | null> {
	const result = await pool.query<{ max: bigint | null }>("SELECT max(id) AS max FROM events");
	return result.rows[0]?.max ?? null;
}
