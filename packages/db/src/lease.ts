/**
 * Leases. `03-RUNTIME` §4.
 *
 * "A worker runs on a node under a lease: a time-bounded, exclusive right to
 * execute that worker, carrying a monotonically increasing epoch number."
 *
 * A lease exists because the control plane cannot tell "the node is dead" from
 * "the node is alive but partitioned". Both look identical from here, and
 * guessing wrong in the direction of death puts two nodes on one worker with the
 * same authority. Both deploy. Both commit.
 *
 * So the control plane never has to guess. It reassigns whenever it likes, and
 * the epoch settles who was right afterwards: the loser finds out on its next
 * write, from the log, and stops. The fencing itself is a trigger in
 * `schema.sql`, because a node that has lost its lease and does not know it
 * cannot be the thing that checks.
 *
 * There is no leases table. A lease is a fold over the log like everything else
 * (`02-CORE` §7), so it survives the projection being deleted.
 */

import type { Pool } from "pg";
import { append, read } from "./log.ts";

export const LEASE_GRANTED = "lease.granted";
export const LEASE_RELEASED = "lease.released";

export interface Lease {
	readonly worker: string;
	/** Which node holds it. Free text at Stage 0, a node identity at slice 3b. */
	readonly node: string;
	/** Monotonic. Every write by this holder carries it. */
	readonly epoch: bigint;
	readonly expiresAt: Date;
	readonly heldSince: Date;
}

/**
 * The lease a worker is under right now, or null if nobody holds one.
 *
 * Expiry is computed rather than recorded, for the same reason capability expiry
 * is: it is a fact about the clock, not something that happened. Nothing writes
 * a `lease.expired` event, because nothing observes the moment it happens.
 */
export function foldLease(
	events: readonly { type: string; payload: Record<string, unknown>; recordedAt: Date }[],
	now: Date = new Date(),
): Lease | null {
	let lease: Lease | null = null;

	for (const event of events) {
		if (event.type === LEASE_GRANTED) {
			const p = event.payload;
			lease = {
				worker: String(p.worker),
				node: String(p.node),
				epoch: BigInt(String(p.epoch)),
				expiresAt: new Date(String(p.expiresAt)),
				heldSince: event.recordedAt,
			};
		} else if (event.type === LEASE_RELEASED) {
			lease = null;
		}
	}

	if (lease !== null && lease.expiresAt <= now) return null;
	return lease;
}

/**
 * The highest epoch ever seen for a worker, held or not.
 *
 * Read from the log rather than from the current lease, because the point of an
 * epoch is that it never goes backwards even when a lease is released, expires,
 * or is granted to a node that immediately dies. A released lease still consumed
 * its number.
 */
export async function highestEpoch(pool: Pool, worker: string): Promise<bigint> {
	const result = await pool.query<{ max: string | null }>(
		"SELECT max(epoch)::text AS max FROM events WHERE actor = $1",
		[worker],
	);
	const max = result.rows[0]?.max;
	return max === null || max === undefined ? 0n : BigInt(max);
}

/**
 * Take the lease on a worker, fencing whoever held it before.
 *
 * Deliberately unconditional. The control plane does not check whether the
 * previous holder is really gone, because it cannot know and asking would mean
 * guessing. It grants the next epoch, and the previous holder discovers the
 * truth on its next write.
 *
 * The grant is written as the worker at the new epoch, so from the instant it
 * lands the old holder is already fenced. Writing it as anyone else would leave
 * a window where the new lease exists and the old one still works.
 */
export async function acquireLease(
	pool: Pool,
	worker: string,
	node: string,
	ttlMs: number,
	now: Date = new Date(),
): Promise<Lease> {
	const epoch = (await highestEpoch(pool, worker)) + 1n;
	const expiresAt = new Date(now.getTime() + ttlMs);

	await append(pool, {
		actor: worker,
		type: LEASE_GRANTED,
		epoch,
		payload: {
			v: 1,
			worker,
			node,
			epoch: epoch.toString(),
			expiresAt: expiresAt.toISOString(),
			ttlMs,
		},
	});

	return { worker, node, epoch, expiresAt, heldSince: now };
}

/**
 * Extend a lease that is still held, at the same epoch.
 *
 * The epoch does not move on renewal. It marks a generation of ownership, and a
 * holder that keeps its lease has not started a new one. Incrementing here would
 * fence the renewer against itself on any write already in flight.
 */
export async function renewLease(
	pool: Pool,
	lease: Lease,
	ttlMs: number,
	now: Date = new Date(),
): Promise<Lease> {
	const expiresAt = new Date(now.getTime() + ttlMs);
	await append(pool, {
		actor: lease.worker,
		type: LEASE_GRANTED,
		epoch: lease.epoch,
		payload: {
			v: 1,
			worker: lease.worker,
			node: lease.node,
			epoch: lease.epoch.toString(),
			expiresAt: expiresAt.toISOString(),
			ttlMs,
			renewal: true,
		},
	});
	return { ...lease, expiresAt };
}

/** Give the lease up on purpose, so the next holder does not wait out the TTL. */
export async function releaseLease(pool: Pool, lease: Lease, reason: string): Promise<void> {
	await append(pool, {
		actor: lease.worker,
		type: LEASE_RELEASED,
		epoch: lease.epoch,
		payload: { v: 1, worker: lease.worker, node: lease.node, reason },
	});
}

/** The lease currently held on a worker, folded from the log. */
export async function getLease(
	pool: Pool,
	worker: string,
	now: Date = new Date(),
): Promise<Lease | null> {
	const events = await read(pool, { actor: worker });
	return foldLease(events, now);
}
