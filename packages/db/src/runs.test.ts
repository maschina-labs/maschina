import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { claimDueRun, finishRun, holdsRun, queueRun, renewLease } from "./runs.ts";

const machineId = newId<"machine">();
const nodeId = newId<"node">();
const runId = newId<"run">();

const row = {
	id: runId,
	machine_id: machineId,
	occurrence_key: "2026-09-21T09:00",
	due_at: "2026-09-21T15:00:00.000Z",
	lease_epoch: "3",
	lease_expires_at: "2026-09-21T15:01:00.000Z",
};

/** A database that answers with whatever rows each statement should return, in order. */
function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { db: { execute } as unknown as Database, execute };
}

describe("queueRun", () => {
	it("reports a new run as created, with the times as dates", async () => {
		const { db } = fakeDatabase([row]);
		const result = await queueRun(db, {
			machineId,
			occurrenceKey: "2026-09-21T09:00",
			dueAt: new Date("2026-09-21T15:00:00.000Z"),
		});
		expect(result.ok && result.value.created).toBe(true);
		expect(result.ok && result.value.dueAt instanceof Date).toBe(true);
	});

	it("accepts times the driver already turned into dates", async () => {
		const { db } = fakeDatabase([{ ...row, due_at: new Date("2026-09-21T15:00:00.000Z") }]);
		const result = await queueRun(db, {
			machineId,
			occurrenceKey: "dates",
			dueAt: new Date("2026-09-21T15:00:00.000Z"),
		});
		expect(result.ok && result.value.dueAt.toISOString()).toBe("2026-09-21T15:00:00.000Z");
	});

	it("returns the run that already exists, without creating a second", async () => {
		const { db, execute } = fakeDatabase([], [row]);
		const result = await queueRun(db, {
			machineId,
			occurrenceKey: "2026-09-21T09:00",
			dueAt: new Date(),
		});
		expect(result.ok && result.value).toMatchObject({ id: runId, created: false });
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it("reports a run that was queued and then vanished as a conflict", async () => {
		const { db } = fakeDatabase([], []);
		const result = await queueRun(db, {
			machineId,
			occurrenceKey: "gone",
			dueAt: new Date(),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("conflict");
	});

	it("refuses an empty occurrence key without touching the database", async () => {
		const { db, execute } = fakeDatabase([row]);
		for (const occurrenceKey of ["", "   "]) {
			const result = await queueRun(db, { machineId, occurrenceKey, dueAt: new Date() });
			expect(result.ok).toBe(false);
		}
		expect(execute).not.toHaveBeenCalled();
	});
});

describe("claimDueRun", () => {
	it("returns the claimed run with its lease", async () => {
		const { db } = fakeDatabase([row]);
		const result = await claimDueRun(db, { nodeId, now: new Date(), leaseSeconds: 60 });
		expect(result.ok && result.value).toMatchObject({ id: runId, leaseEpoch: 3n });
	});

	it("returns nothing when no run is due", async () => {
		const { db } = fakeDatabase([]);
		const result = await claimDueRun(db, { nodeId, now: new Date(), leaseSeconds: 60 });
		expect(result.ok && result.value).toBeUndefined();
	});

	it("refuses a lease that isn't a positive whole number of seconds", async () => {
		const { db, execute } = fakeDatabase([row]);
		for (const leaseSeconds of [0, -1, 1.5, Number.NaN]) {
			const result = await claimDueRun(db, { nodeId, now: new Date(), leaseSeconds });
			expect(result.ok, String(leaseSeconds)).toBe(false);
		}
		expect(execute).not.toHaveBeenCalled();
	});
});

describe("renewLease", () => {
	const lease = { runId, nodeId, leaseEpoch: 3n, now: new Date(), leaseSeconds: 60 };

	it("returns the new expiry when the node still holds the lease", async () => {
		const { db } = fakeDatabase([{ lease_expires_at: "2026-09-21T15:05:00.000Z" }]);
		const result = await renewLease(db, lease);
		expect(result.ok && result.value.toISOString()).toBe("2026-09-21T15:05:00.000Z");
	});

	it("reports a lost lease as a conflict", async () => {
		const { db } = fakeDatabase([]);
		const result = await renewLease(db, lease);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("conflict");
	});
});

describe("finishRun", () => {
	it("finishes a run the node holds", async () => {
		const { db } = fakeDatabase([{ id: runId }]);
		expect((await finishRun(db, { runId, nodeId, leaseEpoch: 3n })).ok).toBe(true);
	});

	it("refuses when the lease has moved on", async () => {
		const { db } = fakeDatabase([]);
		const result = await finishRun(db, { runId, nodeId, leaseEpoch: 2n });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/holding the lease/);
	});
});

describe("holdsRun", () => {
	const lease = { runId, nodeId, leaseEpoch: 3n, now: new Date() };

	it("names the machine when the node holds the run", async () => {
		const { db } = fakeDatabase([{ machine_id: machineId }]);
		expect(await holdsRun(db, lease)).toEqual({ machineId });
	});

	it("says nothing otherwise", async () => {
		const { db } = fakeDatabase([]);
		expect(await holdsRun(db, lease)).toBeUndefined();
	});
});
