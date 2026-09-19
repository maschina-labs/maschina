/**
 * Queueing and claiming runs.
 *
 * Two things must hold no matter how many schedulers or nodes are running:
 *
 * 1. **One run per occurrence.** The same scheduled moment queues once. The database decides this with
 *    a unique key, because any "check then insert" in code has a gap where a second caller slips in.
 * 2. **One node per run.** A run is claimed by exactly one node, for a limited time. The claim is a
 *    single statement that only succeeds if the run is still free, so two nodes racing cannot both win.
 *
 * Every claim raises the run's lease epoch. A node that was cut off and comes back still holds the old
 * epoch, so the record refuses its writes (`appendEvent`), and its work can't be mistaken for current.
 */

import type { RunReportEvent } from "@maschina/contracts";
import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { appendEvent } from "./record.ts";

export type QueuedRun = {
	id: string;
	machineId: string;
	occurrenceKey: string;
	dueAt: Date;
	/** False when this occurrence was already queued, in which case the existing run is returned. */
	created: boolean;
};

export type LeasedRun = {
	id: string;
	machineId: string;
	occurrenceKey: string;
	dueAt: Date;
	leaseEpoch: bigint;
	leaseExpiresAt: Date;
};

type RunRow = {
	id: string;
	machine_id: string;
	occurrence_key: string;
	due_at: string | Date;
	lease_epoch: string | number | bigint;
	lease_expires_at: string | Date;
};

const asDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/**
 * Queues a run for one occurrence. Calling it again for the same occurrence returns the run that
 * already exists, so a scheduler that runs twice, or two schedulers at once, still produce one run.
 */
export async function queueRun(
	db: Database,
	run: { machineId: string; occurrenceKey: string; dueAt: Date },
): Promise<Result<QueuedRun, MaschinaError>> {
	if (run.occurrenceKey.trim() === "") {
		return err(new MaschinaError("invalid_input", "an occurrence key is never empty"));
	}
	const id = newId<"run">();
	const inserted = await db.execute<RunRow>(sql`
		insert into runs (id, machine_id, occurrence_key, due_at)
		values (${id}::uuid, ${run.machineId}::uuid, ${run.occurrenceKey}, ${run.dueAt.toISOString()}::timestamptz)
		on conflict (machine_id, occurrence_key) do nothing
		returning id, machine_id, occurrence_key, due_at`);

	const row = inserted[0];
	if (row) {
		return ok({
			id: row.id,
			machineId: row.machine_id,
			occurrenceKey: row.occurrence_key,
			dueAt: asDate(row.due_at),
			created: true,
		});
	}

	const existing = await db.execute<RunRow>(sql`
		select id, machine_id, occurrence_key, due_at from runs
		where machine_id = ${run.machineId}::uuid and occurrence_key = ${run.occurrenceKey}`);
	const found = existing[0];
	if (!found) {
		return err(new MaschinaError("conflict", "the run was queued and then vanished"));
	}
	return ok({
		id: found.id,
		machineId: found.machine_id,
		occurrenceKey: found.occurrence_key,
		dueAt: asDate(found.due_at),
		created: false,
	});
}

/**
 * Claims one run that is due, for this node, for `leaseSeconds`.
 *
 * A run can be claimed when it is queued, or when it was leased and that lease has expired: a node
 * that died holds nothing forever. `skip locked` means several nodes asking at once each get a
 * different run instead of queueing behind each other.
 */
export async function claimDueRun(
	db: Database,
	options: { nodeId: string; now: Date; leaseSeconds: number },
): Promise<Result<LeasedRun | undefined, MaschinaError>> {
	if (!Number.isInteger(options.leaseSeconds) || options.leaseSeconds <= 0) {
		return err(new MaschinaError("invalid_input", "a lease lasts a whole number of seconds"));
	}
	const now = options.now.toISOString();
	const rows = await db.execute<RunRow>(sql`
		update runs set
			state = 'leased',
			leased_by = ${options.nodeId}::uuid,
			lease_expires_at = ${now}::timestamptz + make_interval(secs => ${options.leaseSeconds}),
			lease_epoch = lease_epoch + 1
		where id = (
			select id from runs
			where due_at <= ${now}::timestamptz
				and (state = 'queued' or (state = 'leased' and lease_expires_at <= ${now}::timestamptz))
			order by due_at
			for update skip locked
			limit 1
		)
		returning id, machine_id, occurrence_key, due_at, lease_epoch, lease_expires_at`);

	const row = rows[0];
	if (!row) return ok(undefined);
	return ok({
		id: row.id,
		machineId: row.machine_id,
		occurrenceKey: row.occurrence_key,
		dueAt: asDate(row.due_at),
		leaseEpoch: BigInt(row.lease_epoch),
		leaseExpiresAt: asDate(row.lease_expires_at),
	});
}

/** Keeps a lease alive while a long-running machine works. Fails if the lease was taken over. */
export async function renewLease(
	db: Database,
	lease: { runId: string; nodeId: string; leaseEpoch: bigint; now: Date; leaseSeconds: number },
): Promise<Result<Date, MaschinaError>> {
	const rows = await db.execute<{ lease_expires_at: string | Date }>(sql`
		update runs set
			lease_expires_at = ${lease.now.toISOString()}::timestamptz + make_interval(secs => ${lease.leaseSeconds})
		where id = ${lease.runId}::uuid
			and leased_by = ${lease.nodeId}::uuid
			and lease_epoch = ${lease.leaseEpoch.toString()}::bigint
			and state = 'leased'
		returning lease_expires_at`);
	const row = rows[0];
	return row
		? ok(asDate(row.lease_expires_at))
		: err(
				new MaschinaError("conflict", "the lease is no longer held by this node", {
					details: { runId: lease.runId, leaseEpoch: lease.leaseEpoch.toString() },
				}),
			);
}

/** Marks a run finished. Only the node holding the current lease may do it. */
export async function finishRun(
	db: Database,
	lease: { runId: string; nodeId: string; leaseEpoch: bigint },
): Promise<Result<void, MaschinaError>> {
	const rows = await db.execute<{ id: string }>(sql`
		update runs set state = 'done', leased_by = null, lease_expires_at = null
		where id = ${lease.runId}::uuid
			and leased_by = ${lease.nodeId}::uuid
			and lease_epoch = ${lease.leaseEpoch.toString()}::bigint
		returning id`);
	return rows[0]
		? ok(undefined)
		: err(new MaschinaError("conflict", "only the node holding the lease may finish the run"));
}

/** What a node may say about a run it holds. Trades go through the signer, never through here. */
export type RunReport = RunReportEvent;

/** Reports that end the run: once recorded, the run is done and its lease is let go. */
const FINAL: ReadonlySet<RunReport["type"]> = new Set(["run.skipped", "run.finished"]);

/**
 * Records what a node says happened on a run, if and only if that node holds the run right now.
 *
 * The lease is checked and locked, the event appended, and a final report closes the run, all in one
 * transaction. So a report can never land after its lease lapsed and another node took the run, and a
 * run can never be closed without its outcome in the record.
 */
export async function reportRun(
	db: Database,
	report: { nodeId: string; runId: string; leaseEpoch: bigint; now: Date; event: RunReport },
): Promise<Result<void, MaschinaError>> {
	if (report.event.payload.runId !== report.runId) {
		return err(new MaschinaError("invalid_input", "the report is about a different run"));
	}

	return db.transaction(async (tx) => {
		const held = await tx.execute<{ machine_id: string }>(sql`
			select machine_id from runs
			where id = ${report.runId}::uuid
				and state = 'leased'
				and leased_by = ${report.nodeId}::uuid
				and lease_epoch = ${report.leaseEpoch.toString()}::bigint
				and lease_expires_at > ${report.now.toISOString()}::timestamptz
			for update`);
		const run = held[0];
		if (!run) {
			return err(
				new MaschinaError("conflict", "this node no longer holds the run", {
					details: { runId: report.runId, leaseEpoch: report.leaseEpoch.toString() },
				}),
			);
		}

		const appended = await appendEvent(tx, {
			machineId: run.machine_id,
			type: report.event.type,
			payload: report.event.payload,
			leaseEpoch: report.leaseEpoch,
		});
		if (!appended.ok) throw appended.error;

		if (FINAL.has(report.event.type)) {
			await tx.execute(sql`
				update runs set state = 'done', leased_by = null, lease_expires_at = null
				where id = ${report.runId}::uuid`);
		}
		return ok(undefined);
	});
}
