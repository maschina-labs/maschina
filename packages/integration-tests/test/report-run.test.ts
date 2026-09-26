/**
 * A node reporting on a run, against real Postgres.
 *
 * A report is only worth recording from the node that holds the run right now. These tests hand a run
 * to a node, let the lease lapse or move to another node, and check what the record accepts.
 */

import { newId } from "@maschina/core";
import {
	claimDueRun,
	createDatabase,
	type DatabaseHandle,
	holdsRun,
	queueRun,
	readMachineEvents,
	reportRun,
	saveDefinition,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "report-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

/** A machine with one run due now, claimed by a node for `leaseSeconds`. */
async function aClaimedRun(leaseSeconds = 60, now = new Date()) {
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
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider, definition_id, name)
		values (${machineId}::uuid, ${owner.id}::uuid, ${address()}, ${"wallet-1"}, ${"turnkey"},
			${saved.value.id}, ${"Weekly SOL"})`;
	await queueRun(handle.db, { machineId, occurrenceKey: newId<"run">(), dueAt: now });

	const nodeId = newId<"node">();
	const claimed = await claimDueRun(handle.db, { nodeId, now, leaseSeconds });
	if (!claimed.ok || !claimed.value || claimed.value.machineId !== machineId) {
		throw new Error("could not claim the run");
	}
	return { machineId, nodeId, run: claimed.value };
}

const finished = (runId: string) => ({
	type: "run.finished" as const,
	payload: { runId, outcome: "completed" as const, durationMs: 1200 },
});

const typesFor = async (machineId: string) => {
	const events = await readMachineEvents(handle.db, machineId);
	return events.map((event) => event.type);
};

const stateOf = async (runId: string) => {
	const [row] = await handle.sql<
		{ state: string }[]
	>`select state from runs where id = ${runId}::uuid`;
	return row?.state;
};

describe("reportRun", () => {
	it("records a report from the node holding the lease, and finishes the run", async () => {
		const { machineId, nodeId, run } = await aClaimedRun();

		const reported = await reportRun(handle.db, {
			nodeId,
			runId: run.id,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			event: finished(run.id),
		});

		expect(reported.ok).toBe(true);
		expect(await typesFor(machineId)).toContain("run.finished");
		expect(await stateOf(run.id)).toBe("done");
	});

	it("records a start without finishing the run", async () => {
		const { machineId, nodeId, run } = await aClaimedRun();

		const reported = await reportRun(handle.db, {
			nodeId,
			runId: run.id,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			event: { type: "run.started", payload: { runId: run.id, nodeId } },
		});

		expect(reported.ok).toBe(true);
		expect(await typesFor(machineId)).toContain("run.started");
		expect(await stateOf(run.id)).toBe("leased");
	});

	it("refuses a report once the lease has expired, and records nothing", async () => {
		const claimedAt = new Date(Date.now() - 120_000);
		const { machineId, nodeId, run } = await aClaimedRun(60, claimedAt);

		const reported = await reportRun(handle.db, {
			nodeId,
			runId: run.id,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			event: finished(run.id),
		});

		expect(reported.ok).toBe(false);
		expect(!reported.ok && reported.error.code).toBe("conflict");
		expect(await typesFor(machineId)).not.toContain("run.finished");
		expect(await stateOf(run.id)).toBe("leased");

		// The lapsed run is due and claimable; close it so later tests claim their own runs.
		await handle.sql`
			update runs set state = 'done', leased_by = null, lease_expires_at = null
			where id = ${run.id}::uuid`;
	});

	it("refuses a report from a node that does not hold the run", async () => {
		const { run } = await aClaimedRun();

		const reported = await reportRun(handle.db, {
			nodeId: newId<"node">(),
			runId: run.id,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			event: finished(run.id),
		});

		expect(!reported.ok && reported.error.code).toBe("conflict");
	});

	it("refuses a report under an older epoch", async () => {
		const { nodeId, run } = await aClaimedRun();

		const reported = await reportRun(handle.db, {
			nodeId,
			runId: run.id,
			leaseEpoch: run.leaseEpoch - 1n,
			now: new Date(),
			event: finished(run.id),
		});

		expect(!reported.ok && reported.error.code).toBe("conflict");
	});

	it("refuses a report about a different run", async () => {
		const { nodeId, run } = await aClaimedRun();

		const reported = await reportRun(handle.db, {
			nodeId,
			runId: run.id,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
			event: finished(newId<"run">()),
		});

		expect(!reported.ok && reported.error.code).toBe("invalid_input");
	});
});

describe("holdsRun", () => {
	it("names the machine when the node holds the run right now", async () => {
		const { machineId, nodeId, run } = await aClaimedRun();
		const held = await holdsRun(handle.db, {
			runId: run.id,
			nodeId,
			leaseEpoch: run.leaseEpoch,
			now: new Date(),
		});
		// The lease answer also says whether this machine spends money or only pretends to.
		expect(held).toEqual({ machineId, paper: false });
	});

	it("says nothing for another node, an old epoch or a lapsed lease", async () => {
		const { nodeId, run } = await aClaimedRun();
		const ask = (overrides: object) =>
			holdsRun(handle.db, {
				runId: run.id,
				nodeId,
				leaseEpoch: run.leaseEpoch,
				now: new Date(),
				...overrides,
			});

		expect(await ask({ nodeId: newId<"node">() })).toBeUndefined();
		expect(await ask({ leaseEpoch: run.leaseEpoch - 1n })).toBeUndefined();
		expect(await ask({ now: new Date(Date.now() + 120_000) })).toBeUndefined();
	});
});
