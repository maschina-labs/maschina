/**
 * The lease fence, against real Postgres.
 *
 * The fence exists for one reason: a node that was cut off must not be able to write to the record
 * after its run was given to somebody else. Everything a machine is, its state, its budget, its
 * limits, is worked out by replaying these rows, so a stale writer is not a lost message, it is a
 * machine that believes something untrue about its own money.
 *
 * Today the fence compares the highest `lease_epoch` any event for the machine has ever carried.
 * But an epoch belongs to a **run**, not to a machine: `claimDueRun` increments the epoch on the run
 * row it claims, so every run counts from one on its own. Comparing them against each other compares
 * two numbers that were never on the same scale.
 *
 * These tests prove what that costs, in both directions. They are written to fail.
 */

import { newId } from "@maschina/core";
import {
	appendEvent,
	claimDueRun,
	createDatabase,
	type DatabaseHandle,
	queueRun,
	saveDefinition,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "epoch-fence-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

async function aMachine() {
	const sql = handle.sql;
	const [owner] = await sql<{ id: string }[]>`
		insert into owners (id, wallet_address) values (${newId<"owner">()}::uuid, ${address()})
		returning id`;
	const saved = await saveDefinition(handle.db, {
		kind: "recurring_buy",
		settings: { amount: address() },
		rules: {},
	});
	if (!owner || !saved.ok) throw new Error("could not set up the test");
	const machineId = newId<"machine">();
	await sql`
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider, definition_id,
			name, paper)
		values (${machineId}::uuid, ${owner.id}::uuid, ${address()}, ${"wallet-1"}, ${"turnkey"},
			${saved.value.id}, ${"Weekly SOL"}, false)`;
	return machineId;
}

const due = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

/** Claims the one run that is due, handing it to a node. */
async function claim(nodeId: string) {
	const claimed = await claimDueRun(handle.db, { nodeId, now: new Date(), leaseSeconds: 300 });
	if (!claimed.ok || !claimed.value) throw new Error("nothing was due to claim");
	return claimed.value;
}

/** What happens when a node dies: its lease runs out and somebody else can take the run. */
async function theNodeDies(runId: string) {
	await handle.sql`
		update runs set lease_expires_at = now() - interval '1 minute' where id = ${runId}::uuid`;
}

/** A run handed from one dead node to the next, so its epoch climbs the way a real one does. */
async function runTakenOver(machineId: string, occurrenceKey: string, times: number) {
	const queued = await queueRun(handle.db, { machineId, occurrenceKey, dueAt: due(10) });
	if (!queued.ok) throw queued.error;
	let last = await claim(newId<"node">());
	for (let i = 1; i < times; i += 1) {
		await theNodeDies(last.id);
		last = await claim(newId<"node">());
	}
	return last;
}

const started = (runId: string) => ({
	type: "run.started",
	runId,
	payload: { runId, nodeId: newId() },
});

describe("an epoch belongs to a run, not to a machine", () => {
	it("lets a fresh run write, even after another run was taken over several times", async () => {
		// The liveness bug. One run changing hands pushes its epoch up. A later run starts counting
		// from one again, which the fence reads as older, so the machine can never act again.
		const machineId = await aMachine();

		const busy = await runTakenOver(machineId, "2026-09-21T09:00", 3);
		expect(busy.leaseEpoch).toBe(3n);
		const first = await appendEvent(handle.db, {
			machineId,
			leaseEpoch: busy.leaseEpoch,
			...started(busy.id),
		});
		expect(first.ok).toBe(true);

		// A new occurrence, claimed once: its own epoch is 1, and it holds the lease right now.
		const queued = await queueRun(handle.db, {
			machineId,
			occurrenceKey: "2026-09-21T10:00",
			dueAt: due(5),
		});
		if (!queued.ok) throw queued.error;
		const fresh = await claim(newId<"node">());
		expect(fresh.leaseEpoch).toBe(1n);

		const written = await appendEvent(handle.db, {
			machineId,
			leaseEpoch: fresh.leaseEpoch,
			...started(fresh.id),
		});

		// It holds the lease. Nothing about it is stale.
		expect(written.ok).toBe(true);
	});

	it("refuses a node whose lease was taken away, even with a high epoch", async () => {
		// The safety gap, the other way round. An old run that changed hands many times carries a
		// bigger number than the run being worked now, so its stale node outranks the live one.
		const machineId = await aMachine();

		const abandoned = await runTakenOver(machineId, "2026-09-22T09:00", 4);
		// And then its last holder dies too, so nobody holds it any more.
		await theNodeDies(abandoned.id);

		const queued = await queueRun(handle.db, {
			machineId,
			occurrenceKey: "2026-09-22T10:00",
			dueAt: due(5),
		});
		if (!queued.ok) throw queued.error;
		const current = await claim(newId<"node">());
		await appendEvent(handle.db, {
			machineId,
			leaseEpoch: current.leaseEpoch,
			...started(current.id),
		});

		// The abandoned run's last holder writes, long after its lease lapsed and was taken over.
		const stale = await appendEvent(handle.db, {
			machineId,
			runId: abandoned.id,
			leaseEpoch: abandoned.leaseEpoch,
			type: "run.finished",
			payload: { runId: abandoned.id, outcome: "completed", durationMs: 10 },
		});

		expect(stale.ok).toBe(false);
	});

	it("refuses a node writing under an epoch it never held", async () => {
		// Nothing today ties the number in the event to the lease that was actually granted, so a
		// node can simply name a bigger one and outrank everybody.
		const machineId = await aMachine();
		const queued = await queueRun(handle.db, {
			machineId,
			occurrenceKey: "2026-09-23T09:00",
			dueAt: due(5),
		});
		if (!queued.ok) throw queued.error;
		const run = await claim(newId<"node">());

		const invented = await appendEvent(handle.db, {
			machineId,
			leaseEpoch: run.leaseEpoch + 9_000n,
			...started(run.id),
		});

		expect(invented.ok).toBe(false);
	});
});
