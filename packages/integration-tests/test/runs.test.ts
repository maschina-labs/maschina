/**
 * The run queue, against real Postgres.
 *
 * These prove the two claims the whole scheduler rests on: a scheduled occurrence queues exactly once,
 * and a run is held by exactly one node at a time. Both are decided by the database, so both are tested
 * with real connections racing each other rather than with a mock.
 */

import { newId } from "@maschina/core";
import {
	claimDueRun,
	createDatabase,
	type DatabaseHandle,
	finishRun,
	queueRun,
	renewLease,
	saveDefinition,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "runs-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

/** A machine to hang runs off, with its owner and definition. */
async function aMachine() {
	const sql = handle.sql;
	const [owner] = await sql<{ id: string }[]>`
		insert into owners (wallet_address) values (${address()}) returning id`;
	const saved = await saveDefinition(handle.db, {
		kind: "recurring_buy",
		settings: { amount: address() },
		rules: {},
	});
	if (!owner || !saved.ok) throw new Error("could not set up the test");
	const machineId = newId<"machine">();
	await sql`
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider, definition_id, name)
		values (${machineId}::uuid, ${owner.id}::uuid, ${address()}, ${"wallet-1"}, ${"turnkey"},
			${saved.value.id}, ${"Weekly SOL"})`;
	return machineId;
}

const due = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

describe("queueRun", () => {
	it("queues a run for an occurrence", async () => {
		const machineId = await aMachine();
		const result = await queueRun(handle.db, {
			machineId,
			occurrenceKey: "2026-09-21T09:00",
			dueAt: due(0),
		});
		expect(result.ok && result.value.created).toBe(true);
	});

	it("queues the same occurrence once, however many times it is asked", async () => {
		const machineId = await aMachine();
		const run = { machineId, occurrenceKey: "2026-09-21T09:00", dueAt: due(0) };
		const first = await queueRun(handle.db, run);
		const second = await queueRun(handle.db, run);
		expect(first.ok && second.ok && first.value.id === second.value.id).toBe(true);
		expect(second.ok && second.value.created).toBe(false);
	});

	it("queues once when two schedulers ask at the same moment", async () => {
		const machineId = await aMachine();
		const run = { machineId, occurrenceKey: "2026-09-22T09:00", dueAt: due(0) };
		// Separate connections, so this is a real race, not two calls sharing a client.
		const connections = Array.from({ length: 8 }, () =>
			createDatabase({ url: database.appUrl, applicationName: "racing-scheduler" }),
		);
		try {
			const results = await Promise.all(connections.map((c) => queueRun(c.db, run)));
			const ids = new Set(results.map((r) => (r.ok ? r.value.id : "failed")));
			const created = results.filter((r) => r.ok && r.value.created);
			expect(ids.size).toBe(1);
			expect(created).toHaveLength(1);
		} finally {
			await Promise.all(connections.map((c) => c.close()));
		}
	});

	it("keeps each occurrence separate, and each machine's separately again", async () => {
		const machineId = await aMachine();
		const other = await aMachine();
		const a = await queueRun(handle.db, { machineId, occurrenceKey: "a", dueAt: due(0) });
		const b = await queueRun(handle.db, { machineId, occurrenceKey: "b", dueAt: due(0) });
		const c = await queueRun(handle.db, { machineId: other, occurrenceKey: "a", dueAt: due(0) });
		const ids = [a, b, c].map((r) => (r.ok ? r.value.id : ""));
		expect(new Set(ids).size).toBe(3);
	});

	it("refuses an empty occurrence key", async () => {
		const machineId = await aMachine();
		const result = await queueRun(handle.db, { machineId, occurrenceKey: " ", dueAt: due(0) });
		expect(result.ok).toBe(false);
	});
});

describe("claimDueRun", () => {
	it("gives a due run to the node that asks, with a lease", async () => {
		const machineId = await aMachine();
		await queueRun(handle.db, { machineId, occurrenceKey: "claim-1", dueAt: due(5) });
		const nodeId = newId<"node">();
		const claimed = await claimDueRun(handle.db, { nodeId, now: new Date(), leaseSeconds: 60 });
		expect(claimed.ok && claimed.value?.machineId).toBe(machineId);
		expect(claimed.ok && claimed.value && claimed.value.leaseEpoch > 0n).toBe(true);
		expect(claimed.ok && claimed.value && claimed.value.leaseExpiresAt > new Date()).toBe(true);
	});

	it("gives a run to exactly one of several nodes claiming at once", async () => {
		const machineId = await aMachine();
		await queueRun(handle.db, { machineId, occurrenceKey: "claim-race", dueAt: due(5) });
		const connections = Array.from({ length: 8 }, () =>
			createDatabase({ url: database.appUrl, applicationName: "racing-node" }),
		);
		try {
			const now = new Date();
			const results = await Promise.all(
				connections.map((c) =>
					claimDueRun(c.db, { nodeId: newId<"node">(), now, leaseSeconds: 60 }),
				),
			);
			const claimed = results.filter((r) => r.ok && r.value?.occurrenceKey === "claim-race");
			expect(claimed).toHaveLength(1);
		} finally {
			await Promise.all(connections.map((c) => c.close()));
		}
	});

	it("leaves runs that aren't due yet alone", async () => {
		const machineId = await aMachine();
		await queueRun(handle.db, {
			machineId,
			occurrenceKey: "future",
			dueAt: new Date(Date.now() + 60 * 60_000),
		});
		const claimed = await claimDueRun(handle.db, {
			nodeId: newId<"node">(),
			now: new Date(),
			leaseSeconds: 60,
		});
		expect(claimed.ok && claimed.value?.occurrenceKey).not.toBe("future");
	});

	it("hands a run to another node once the first node's lease has expired", async () => {
		const machineId = await aMachine();
		await queueRun(handle.db, { machineId, occurrenceKey: "expired", dueAt: due(10) });
		const first = newId<"node">();
		const claimed = await claimDueRun(handle.db, {
			nodeId: first,
			now: new Date(),
			leaseSeconds: 1,
		});
		expect(claimed.ok && claimed.value?.occurrenceKey).toBe("expired");

		// A moment after the lease has run out, as if the first node died.
		const later = new Date(Date.now() + 5_000);
		const second = await claimDueRun(handle.db, {
			nodeId: newId<"node">(),
			now: later,
			leaseSeconds: 60,
		});
		expect(second.ok && second.value?.occurrenceKey).toBe("expired");
		// The epoch rose, so the first node's writes are now stale.
		const firstEpoch = claimed.ok && claimed.value ? claimed.value.leaseEpoch : 0n;
		const secondEpoch = second.ok && second.value ? second.value.leaseEpoch : 0n;
		expect(secondEpoch).toBe(firstEpoch + 1n);
	});

	it("says nothing is due when the queue is empty", async () => {
		const sql = handle.sql;
		await sql`delete from runs where state = 'queued'`;
		const claimed = await claimDueRun(handle.db, {
			nodeId: newId<"node">(),
			now: new Date(0),
			leaseSeconds: 60,
		});
		expect(claimed.ok && claimed.value).toBeUndefined();
	});

	it("refuses a lease that isn't a whole number of seconds", async () => {
		const result = await claimDueRun(handle.db, {
			nodeId: newId<"node">(),
			now: new Date(),
			leaseSeconds: 0,
		});
		expect(result.ok).toBe(false);
	});
});

describe("renewLease and finishRun", () => {
	async function leasedRun(key: string) {
		const machineId = await aMachine();
		await queueRun(handle.db, { machineId, occurrenceKey: key, dueAt: due(5) });
		const nodeId = newId<"node">();
		const claimed = await claimDueRun(handle.db, { nodeId, now: new Date(), leaseSeconds: 60 });
		if (!claimed.ok || !claimed.value) throw new Error("could not claim the run");
		return { nodeId, run: claimed.value };
	}

	it("extends the lease for the node holding it", async () => {
		const { nodeId, run } = await leasedRun("renew");
		const renewed = await renewLease(handle.db, {
			runId: run.id,
			nodeId,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			leaseSeconds: 300,
		});
		expect(renewed.ok && renewed.value > run.leaseExpiresAt).toBe(true);
	});

	it("refuses to extend a lease the node no longer holds", async () => {
		const { run } = await leasedRun("renew-stale");
		const renewed = await renewLease(handle.db, {
			runId: run.id,
			nodeId: newId<"node">(),
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			leaseSeconds: 300,
		});
		expect(renewed.ok).toBe(false);
	});

	it("finishes a run, and won't let a stale node finish it", async () => {
		const { nodeId, run } = await leasedRun("finish");
		const stale = await finishRun(handle.db, {
			runId: run.id,
			nodeId,
			leaseEpoch: run.leaseEpoch - 1n,
		});
		expect(stale.ok).toBe(false);

		const done = await finishRun(handle.db, { runId: run.id, nodeId, leaseEpoch: run.leaseEpoch });
		expect(done.ok).toBe(true);

		const [row] = await handle.sql<{ state: string; leased_by: string | null }[]>`
			select state, leased_by from runs where id = ${run.id}`;
		expect(row).toEqual({ state: "done", leased_by: null });
	});

	it("never hands out a finished run again", async () => {
		const { nodeId, run } = await leasedRun("finished-once");
		await finishRun(handle.db, { runId: run.id, nodeId, leaseEpoch: run.leaseEpoch });
		const later = new Date(Date.now() + 60 * 60_000);
		const again = await claimDueRun(handle.db, {
			nodeId: newId<"node">(),
			now: later,
			leaseSeconds: 60,
		});
		expect(again.ok && again.value?.id).not.toBe(run.id);
	});
});

describe("the runs table itself", () => {
	it("refuses a run for a machine that doesn't exist", async () => {
		await expect(
			handle.sql`
				insert into runs (id, machine_id, occurrence_key, due_at)
				values (${newId<"run">()}::uuid, ${newId<"machine">()}::uuid, ${"orphan"}, now())`,
		).rejects.toThrow(/foreign key|violates/i);
	});

	it("refuses a state nobody defined, and half a lease", async () => {
		const machineId = await aMachine();
		const id = newId<"run">();
		await handle.sql`
			insert into runs (id, machine_id, occurrence_key, due_at)
			values (${id}::uuid, ${machineId}::uuid, ${"checks"}, now())`;
		await expect(handle.sql`update runs set state = 'whatever' where id = ${id}`).rejects.toThrow(
			/runs_state_known/i,
		);
		await expect(
			handle.sql`update runs set leased_by = ${newId<"node">()}::uuid where id = ${id}`,
		).rejects.toThrow(/runs_lease_complete/i);
	});
});
