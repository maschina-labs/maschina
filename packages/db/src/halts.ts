/**
 * The kill switch.
 *
 * Two things, and the order matters. Engaging a halt stops money moving, because the signer reads it
 * before it will sign anything and refuses while one is in force. Stopping every machine then makes the
 * record agree: nothing new is queued and every machine says out loud that it is stopped.
 *
 * The halt is the part that has to work when the thing being stopped is misbehaving. A node that keeps
 * proposing after a halt is refused by the signer, so stopping does not need the cooperation of whatever
 * has gone wrong. Asking machines nicely to stop is the second half, not the first.
 *
 * A halt does not stop an owner taking their money out. A switch that also trapped people's funds would
 * be a worse outcome than whatever it was thrown for.
 */

import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Database, Executor } from "./client.ts";
import { appendOwnerEvent } from "./record.ts";

export type Halt = {
	id: string;
	reason: string;
	engagedBy: string;
	engagedAt: Date;
};

type HaltRow = { id: string; reason: string; engaged_by: string; engaged_at: string | Date };

/** The halt in force right now, if there is one. Read by the signer on every proposal. */
export async function haltInForce(db: Executor): Promise<Halt | undefined> {
	const rows = await db.execute<HaltRow>(sql`
		select id, reason, engaged_by, engaged_at from halts
		where released_at is null
		order by engaged_at desc
		limit 1`);

	const row = rows[0];
	if (!row) return undefined;
	return {
		id: row.id,
		reason: row.reason,
		engagedBy: row.engaged_by,
		engagedAt: row.engaged_at instanceof Date ? row.engaged_at : new Date(row.engaged_at),
	};
}

/** Engages a halt. Signing stops from this moment, for every machine. */
export async function engageHalt(
	db: Executor,
	halt: { reason: string; engagedBy: string },
): Promise<Result<{ id: string }, MaschinaError>> {
	const reason = halt.reason.trim();
	const engagedBy = halt.engagedBy.trim();
	if (reason === "") {
		// Somebody will read this at three in the morning wondering what happened.
		return err(new MaschinaError("invalid_input", "a halt has to say why it was engaged"));
	}
	if (engagedBy === "") {
		return err(new MaschinaError("invalid_input", "a halt has to say who engaged it"));
	}

	const id = newId<"halt">();
	const rows = await db.execute<{ id: string }>(sql`
		insert into halts (id, reason, engaged_by)
		values (${id}::uuid, ${reason.slice(0, 500)}, ${engagedBy.slice(0, 200)})
		returning id`);

	const row = rows[0];
	return row ? ok({ id: row.id }) : err(new MaschinaError("internal", "the halt was not written"));
}

/** Releases whatever halt is in force. Refuses when there is none, rather than pretending. */
export async function releaseHalt(
	db: Executor,
	release: { releasedBy: string },
): Promise<Result<{ id: string }, MaschinaError>> {
	const releasedBy = release.releasedBy.trim();
	if (releasedBy === "") {
		return err(new MaschinaError("invalid_input", "a release has to say who released it"));
	}

	const rows = await db.execute<{ id: string }>(sql`
		update halts set released_at = now(), released_by = ${releasedBy.slice(0, 200)}
		where released_at is null
		returning id`);

	const row = rows[0];
	return row ? ok({ id: row.id }) : err(new MaschinaError("not_found", "nothing is halted"));
}

/**
 * Stops every machine that is not stopped already.
 *
 * One transaction, so a machine cannot be started by somebody else halfway through. Each stop is written
 * as the owner's own action, because that is what it is: the platform acting on the owner's behalf, not a
 * node reporting.
 */
export async function stopEveryMachine(
	db: Database,
	how: { reason: string; by: string },
): Promise<Result<{ stopped: number }, MaschinaError>> {
	return db.transaction(async (tx) => {
		// Everything with a machine.started or machine.resumed that is not followed by a stop. Worked out
		// in the database rather than by reading every machine's events in turn, because this has to be
		// quick when it is needed.
		const rows = await tx.execute<{ id: string }>(sql`
			select machines.id from machines
			where exists (
				select 1 from events
				where events.machine_id = machines.id
					and events.type in ('machine.started', 'machine.resumed', 'machine.paused')
			)
			and not exists (
				select 1 from events
				where events.machine_id = machines.id and events.type = 'machine.stopped'
			)
			for update`);

		let stopped = 0;
		for (const row of rows) {
			const written = await appendOwnerEvent(tx, {
				machineId: row.id,
				type: "machine.stopped",
				payload: { by: "system", reason: `${how.reason} (${how.by})`.slice(0, 500) },
			});
			if (!written.ok) return written;
			stopped += 1;
		}

		return ok({ stopped });
	});
}
