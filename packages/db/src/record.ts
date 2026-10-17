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
 *
 * An owner's own action goes through `appendOwnerEvent` instead, because the second rule is about nodes
 * and an owner is not one. See the comment there: getting this wrong made pause and stop impossible on
 * any machine that had ever run.
 */

import { parseEvent } from "@maschina/contracts";
import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

export type EventToAppend = {
	machineId: string;
	type: string;
	payload: unknown;
	/**
	 * The run whose lease permits this write.
	 *
	 * Required, because the lease is the permission. An event caused by somebody who holds no run,
	 * an owner pausing a machine or a machine being created, goes through `appendOwnerEvent`.
	 */
	runId: string;
	/** The epoch of the lease the writer holds, which has to be the one the run really has. */
	leaseEpoch: bigint;
};

export type AppendedEvent = { id: string; occurredAt: Date };

export type AppendResult = Result<AppendedEvent, MaschinaError>;

export async function appendEvent(db: Executor, event: EventToAppend): Promise<AppendResult> {
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
	//
	// The write is conditional on the lease still being held, checked against the runs table in this
	// same statement so nothing can change between asking and writing. Three things have to be true
	// at once: the run belongs to this machine, its epoch is exactly the one the writer claims, and
	// the lease has not run out.
	//
	// It used to compare the highest epoch any event for the MACHINE had ever carried. An epoch
	// belongs to a run, though, and every run counts from one of its own, so that compared two
	// numbers that were never on the same scale: a fresh run was refused for being "older" than a
	// finished one, a dead node outranked a live one, and an invented epoch was accepted because
	// nothing tied the number to a lease that had been granted.
	const rows = await db.execute<{ id: string; occurred_at: string | Date }>(sql`
		insert into events (id, machine_id, type, payload, lease_epoch)
		select ${id}::uuid, ${checked.value.machineId}::uuid, ${checked.value.type},
			${JSON.stringify(checked.value.payload)}::jsonb, ${event.leaseEpoch.toString()}::bigint
		where exists (
			select 1 from runs
			where id = ${event.runId}::uuid
				and machine_id = ${checked.value.machineId}::uuid
				and lease_epoch = ${event.leaseEpoch.toString()}::bigint
				and lease_expires_at > now()
		)
		returning id, occurred_at`);

	const written = rows[0];
	if (!written) {
		return err(
			new MaschinaError("conflict", "this run's lease is not held at that epoch", {
				details: {
					machineId: event.machineId,
					runId: event.runId,
					leaseEpoch: event.leaseEpoch.toString(),
				},
			}),
		);
	}
	return ok({ id: written.id, occurredAt: new Date(written.occurred_at) });
}

/** An owner's action, which has no lease because an owner is not a node. */
export type OwnerEventToAppend = { machineId: string; type: string; payload: unknown };

/**
 * Writes an event an owner caused: pausing, resuming, stopping, funding, withdrawing.
 *
 * The lease fence exists to stop a node that was cut off from writing after its run was given away.
 * An owner is not a node and can never be stale, so their actions are not fenced at all: there is no
 * run to check them against, because starting, pausing or funding a machine belongs to no run.
 *
 * The event is written under the newest epoch the machine has seen, so the record still says which
 * era of the machine's life it belongs to.
 */
export async function appendOwnerEvent(
	db: Executor,
	event: OwnerEventToAppend,
): Promise<AppendResult> {
	const checked = parseEvent({ ...event, leaseEpoch: 0n });
	if (!checked.ok) {
		return err(
			new MaschinaError("invalid_input", "the event doesn't match its type", {
				details: { type: event.type, problems: checked.error.issues.map((issue) => issue.path) },
			}),
		);
	}

	const id = newId<"event">();
	const rows = await db.execute<{ id: string; occurred_at: string | Date }>(sql`
		insert into events (id, machine_id, type, payload, lease_epoch)
		values (${id}::uuid, ${checked.value.machineId}::uuid, ${checked.value.type},
			${JSON.stringify(checked.value.payload)}::jsonb,
			coalesce((select max(lease_epoch) from events
				where machine_id = ${checked.value.machineId}::uuid), 0))
		returning id, occurred_at`);

	const written = rows[0];
	if (!written) {
		return err(
			new MaschinaError("internal", "the owner's action was not written", {
				details: { machineId: event.machineId, type: event.type },
			}),
		);
	}
	return ok({ id: written.id, occurredAt: new Date(written.occurred_at) });
}

/**
 * Writes down what the chain did with a trade that was already signed.
 *
 * **Never fenced, on purpose.** A lease is permission to *decide* something. This decides nothing: the
 * transaction landed or it did not, money moved or it did not, and that is equally true whoever holds
 * the run now. A node can be cut off halfway through a trade, and the trade carries on without it.
 *
 * Fencing this would mean refusing to record a trade that really happened because the lease had moved
 * on, which is the same failure as releasing a budget for a trade that landed: the record would say a
 * thing did not happen when it did. That is the worst thing the record can say, so it is the one thing
 * the fence is not allowed to cause.
 *
 * Three voices write to the record, and each is checked differently: a node, which must hold the run it
 * names; an owner, who holds nothing and can never be stale; and the chain, which is simply true.
 */
export async function appendChainOutcome(
	db: Executor,
	event: OwnerEventToAppend,
): Promise<AppendResult> {
	const written = await appendOwnerEvent(db, event);
	if (written.ok || written.error.code !== "internal") return written;
	// The same write, but it is not an owner acting, so it does not say so when it goes wrong.
	return err(
		new MaschinaError("internal", "what the chain did was not written down", {
			details: { machineId: event.machineId, type: event.type },
		}),
	);
}
