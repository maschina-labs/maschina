/**
 * The lease fold.
 *
 * A lease has no row. Its entire existence is these events folded in order, so
 * if this is wrong two nodes can believe they hold the same worker and both act
 * on it, which is the failure `03-RUNTIME` §4 exists to prevent.
 */

import { describe, expect, it } from "vitest";
import { foldLease, LEASE_GRANTED, LEASE_RELEASED } from "./lease.ts";

type LogEvent = { type: string; payload: Record<string, unknown>; recordedAt: Date };

const AT = (iso: string) => new Date(iso);
const T0 = AT("2026-01-01T00:00:00.000Z");

const granted = (
	epoch: number,
	node = "node:a",
	expiresAt = "2026-01-01T00:05:00.000Z",
	recordedAt = T0,
): LogEvent => ({
	type: LEASE_GRANTED,
	recordedAt,
	payload: { v: 1, worker: "worker:w1", node, epoch: String(epoch), expiresAt },
});

const released = (recordedAt = T0): LogEvent => ({
	type: LEASE_RELEASED,
	recordedAt,
	payload: { v: 1, worker: "worker:w1", node: "node:a", reason: "done" },
});

describe("foldLease", () => {
	it("is null when nobody has ever held one", () => {
		expect(foldLease([], T0)).toBeNull();
	});

	it("reads a granted lease", () => {
		const lease = foldLease([granted(1)], T0);
		expect(lease?.node).toBe("node:a");
		expect(lease?.epoch).toBe(1n);
		expect(lease?.worker).toBe("worker:w1");
	});

	it("gives the lease to the most recent grant", () => {
		const lease = foldLease([granted(1, "node:a"), granted(2, "node:b")], T0);
		expect(lease?.node).toBe("node:b");
		expect(lease?.epoch).toBe(2n);
	});

	it("is null once the lease has expired", () => {
		// Expiry is computed, not recorded. Nothing observes the moment a lease
		// runs out, so nothing can write an event at that moment.
		const lease = foldLease([granted(1)], AT("2026-01-01T00:05:00.001Z"));
		expect(lease).toBeNull();
	});

	it("holds right up to the expiry instant and not past it", () => {
		expect(foldLease([granted(1)], AT("2026-01-01T00:04:59.999Z"))).not.toBeNull();
		expect(foldLease([granted(1)], AT("2026-01-01T00:05:00.000Z"))).toBeNull();
	});

	it("is null after an explicit release", () => {
		expect(foldLease([granted(1), released()], T0)).toBeNull();
	});

	it("can be taken again after a release", () => {
		const lease = foldLease([granted(1), released(), granted(2, "node:b")], T0);
		expect(lease?.node).toBe("node:b");
		expect(lease?.epoch).toBe(2n);
	});

	it("keeps the epoch when a renewal extends the same lease", () => {
		// A holder that keeps its lease has not started a new generation.
		// Incrementing on renewal would fence the renewer against its own writes.
		const lease = foldLease(
			[granted(3), granted(3, "node:a", "2026-01-01T00:10:00.000Z")],
			AT("2026-01-01T00:06:00.000Z"),
		);
		expect(lease?.epoch).toBe(3n);
		expect(lease).not.toBeNull();
	});

	it("ignores event types it does not know about", () => {
		// The log will grow types this function predates, and an unknown one must
		// not drop a lease that is genuinely held.
		const lease = foldLease(
			[granted(1), { type: "invented.later", recordedAt: T0, payload: {} }],
			T0,
		);
		expect(lease?.epoch).toBe(1n);
	});

	it("records when the holder took it, not when it was granted in payload", () => {
		const lease = foldLease([granted(1, "node:a", "2026-01-01T00:05:00.000Z", T0)], T0);
		expect(lease?.heldSince).toEqual(T0);
	});

	it("does not let an expired lease be resurrected by a later unrelated event", () => {
		// An expired lease is gone. Nothing but a new grant brings one back, and a
		// fold that let anything else do it would hand a dead node its work again.
		const lease = foldLease(
			[granted(1), { type: "invented.later", recordedAt: T0, payload: {} }],
			AT("2026-01-01T01:00:00.000Z"),
		);
		expect(lease).toBeNull();
	});
});
