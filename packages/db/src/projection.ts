/**
 * Projections, and rebuilding them. `02-CORE` §7.
 *
 * "The event log is the only durable state. All other state is a projection,
 * deletable and rebuildable at any time."
 *
 * **Nothing here is materialised, and that is the answer rather than an
 * omission.** `events` is the only table in the database. Every capability,
 * objective, lease, workspace and evaluation is folded from the log at the
 * moment it is asked for. So "delete every projection and rebuild" is satisfied
 * by construction: there is nothing to go stale, and nothing to forget to
 * invalidate.
 *
 * That is not free, and `snapshot` below exists to measure what it costs. A3
 * predicts fold cost bites first in per-step context assembly, and the honest
 * time to materialise anything is when a measurement says so, not before
 * (`01-PRINCIPLES` P12).
 *
 * **One projection must never be materialised**, whatever the measurements say:
 * the capability check. `05-CAPABILITIES` §4 requires authority to be checked at
 * use and never cached, and a materialised capability table is exactly that
 * cache. It is also what the emergency stop depends on: a stale copy would make
 * revocation advisory, and P3 does not yield.
 */

import type { Pool } from "pg";
import { list as listCapabilities } from "./capability.ts";
import { evaluationsOf } from "./evaluation.ts";
import { read } from "./log.ts";
import { list as listObjectives } from "./objective.ts";
import { foldWorkspaces } from "./workspace.ts";

/**
 * Everything derived, folded fresh from the log.
 *
 * Used to compare a system against itself across a rebuild. Serialised rather
 * than returned as objects, because the comparison that matters is "identical",
 * and deep-equality on live objects hides differences that a diff would show.
 */
export interface Snapshot {
	readonly events: number;
	readonly capabilities: string;
	readonly objectives: string;
	readonly workspaces: string;
	readonly evaluations: string;
	/** How long folding all of it took, in milliseconds. A3's measurement. */
	readonly foldMs: number;
}

/** BigInts do not serialise, and event ids are bigints. */
function stable(value: unknown): string {
	return JSON.stringify(value, (_key, v: unknown) =>
		typeof v === "bigint" ? v.toString() : v,
	);
}

export async function snapshot(pool: Pool): Promise<Snapshot> {
	const started = Date.now();
	const events = await read(pool);
	const capabilities = await listCapabilities(pool);
	const objectives = await listObjectives(pool);
	const workspaces = foldWorkspaces(events);

	const evaluations: unknown[] = [];
	for (const objective of objectives) {
		evaluations.push(...(await evaluationsOf(pool, objective.id)));
	}

	return {
		events: events.length,
		capabilities: stable(capabilities),
		objectives: stable(objectives),
		workspaces: stable(workspaces),
		evaluations: stable(evaluations),
		foldMs: Date.now() - started,
	};
}

/** One event, exactly as it sits in the log, including the fields the app cannot write. */
export interface DumpedEvent {
	readonly id: string;
	readonly recordedAt: string;
	readonly actor: string;
	readonly objective: string | null;
	readonly type: string;
	readonly payload: Record<string, unknown>;
	readonly epoch: string;
	readonly causation: string | null;
}

/**
 * Read the whole log out, ids and timestamps included.
 *
 * `read` deliberately returns the shape the rest of the system uses. This
 * returns the shape a restore needs, which is different: it has to carry `id`
 * and `recorded_at`, the two columns the application role is forbidden from
 * writing.
 */
export async function dumpLog(pool: Pool): Promise<DumpedEvent[]> {
	const result = await pool.query<{
		id: string;
		recorded_at: Date;
		actor: string;
		objective: string | null;
		type: string;
		payload: Record<string, unknown>;
		epoch: string;
		causation: string | null;
	}>(
		`SELECT id::text, recorded_at, actor, objective, type, payload, epoch::text, causation::text
     FROM events ORDER BY id ASC`,
	);
	return result.rows.map((r) => ({
		id: r.id,
		recordedAt: r.recorded_at.toISOString(),
		actor: r.actor,
		objective: r.objective,
		type: r.type,
		payload: r.payload,
		epoch: r.epoch,
		causation: r.causation,
	}));
}

/**
 * Put a dumped log back, with its ids intact.
 *
 * **Requires the admin pool, and that is the design working rather than an
 * inconvenience.** The application role holds a column-level INSERT that
 * excludes `id` and `recorded_at`, which is what makes log order unforgeable by
 * anything running normally. The same grant makes restore impossible for that
 * role, so restoring is an operator action, performed deliberately, by a role
 * the workers do not have.
 *
 * Ids must be preserved rather than reassigned. `causation` is an event id, so
 * renumbering on restore would silently repoint every causal link in the
 * history, and the log would still look valid.
 *
 * Restored in id order, which never trips the fencing trigger: a write carrying
 * an epoch below the highest seen for its actor was refused when it was first
 * attempted, so no such row is in the log to replay.
 */
export async function restoreLog(admin: Pool, events: readonly DumpedEvent[]): Promise<number> {
	for (const event of events) {
		await admin.query(
			`INSERT INTO events (id, recorded_at, actor, objective, type, payload, epoch, causation)
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				event.id,
				event.recordedAt,
				event.actor,
				event.objective,
				event.type,
				JSON.stringify(event.payload),
				event.epoch,
				event.causation,
			],
		);
	}

	// The identity sequence knows nothing about ids inserted around it. Left
	// alone, the next ordinary append collides with a restored row, and the
	// failure would arrive later and look unrelated.
	await admin.query(
		"SELECT setval(pg_get_serial_sequence('events', 'id'), COALESCE((SELECT max(id) FROM events), 1))",
	);

	return events.length;
}
