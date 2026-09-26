import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { actOnMachine, machineForOwner, machinesOf } from "./owner-machines.ts";

// Against a real database this is proved in packages/integration-tests.

const ownerId = newId<"owner">();
const machineId = newId<"machine">();

const event = (type: string, payload: object) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type,
	payload,
	occurred_at: "2026-09-20T09:00:00.000Z",
});

const funded = event("machine.limits_changed", {
	limit: "budgetGranted",
	from: null,
	to: "1000",
});
const started = event("machine.started", {});

const row = {
	id: machineId,
	name: "First",
	kind: "price_trigger",
	settings: { level: "142000000" },
	wallet_address: "So11111111111111111111111111111111111111112",
	created_at: "2026-09-20T08:00:00.000Z",
};

/** Answers every query in the order the module asks them. */
function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async (_query: unknown) => answers.shift() ?? []);
	const db = { execute, transaction: async (run: (tx: unknown) => unknown) => run(db) };
	return db as unknown as Database;
}

/** The fixed parts of the last statement run: the event type and its payload are among them. */
function lastStatement(db: Database): string[] {
	const [query] = vi.mocked(db.execute).mock.calls.at(-1) ?? [];
	const chunks = (query as unknown as { queryChunks: unknown[] }).queryChunks;
	return chunks.filter((chunk): chunk is string => typeof chunk === "string");
}

const lastPayload = (db: Database) =>
	JSON.parse(lastStatement(db).find((chunk) => chunk.startsWith("{")) ?? "{}") as Record<
		string,
		string
	>;

describe("machinesOf", () => {
	it("summarises each machine with the state and budget its record adds up to", async () => {
		const machines = await machinesOf(fakeDatabase([row], [funded, started]), ownerId);

		expect(machines).toEqual([
			{
				machineId,
				name: "First",
				kind: "price_trigger",
				walletAddress: row.wallet_address,
				createdAt: new Date(row.created_at),
				state: "running",
				budget: { granted: 1000n, reserved: 0n, settled: 0n, available: 1000n },
				// A machine that has not traded has made nothing, which is not the same as having lost.
				result: {
					realised: 0n,
					position: 0n,
					basis: 0n,
					feesLamports: 0n,
					trades: 0,
					roundTrips: 0,
					wins: 0,
					losses: 0,
					simulated: false,
				},
			},
		]);
	});

	it("says why a machine is not running when its record says so", async () => {
		const paused = event("machine.paused", { reason: "owner" });
		const [machine] = await machinesOf(fakeDatabase([row], [funded, started, paused]), ownerId);

		expect(machine?.state).toBe("paused");
		expect(machine?.stateReason).toBe("owner");
	});

	it("is empty for an owner with no machines", async () => {
		expect(await machinesOf(fakeDatabase([]), ownerId)).toEqual([]);
	});
});

describe("machineForOwner", () => {
	it("adds the limits and what the owner may do next", async () => {
		const limit = event("machine.limits_changed", {
			limit: "maxPerTrade",
			from: null,
			to: "500",
		});
		const events = [funded, limit, started];
		const machine = await machineForOwner(fakeDatabase([row], events, events), ownerId, machineId);

		expect(machine?.settings).toEqual(row.settings);
		expect(machine?.limits.maxPerTrade).toBe(500n);
		expect(machine?.actions).toEqual(["fund", "pause", "stop"]);
	});

	it("does not find a machine belonging to somebody else", async () => {
		expect(await machineForOwner(fakeDatabase([]), ownerId, machineId)).toBeUndefined();
	});

	it("offers nothing to do once a machine is stopped", async () => {
		const events = [funded, started, event("machine.stopped", { by: "owner" })];
		const machine = await machineForOwner(fakeDatabase([row], events, events), ownerId, machineId);

		expect(machine?.state).toBe("stopped");
		expect(machine?.actions).toEqual([]);
	});
});

describe("actOnMachine", () => {
	const written = () => [{ id: newId<"event">(), occurred_at: "2026-09-20T10:00:00.000Z" }];

	it("refuses to fund without a budget above zero", async () => {
		const db = fakeDatabase();
		const result = await actOnMachine(db, { ownerId, machineId, action: "fund" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("invalid_input");
	});

	it("does not find a machine that is not this owner's", async () => {
		const result = await actOnMachine(fakeDatabase([]), {
			ownerId,
			machineId,
			action: "start",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("not_found");
	});

	it("refuses an action the machine's state does not allow", async () => {
		const db = fakeDatabase([{ id: machineId }], []);
		const result = await actOnMachine(db, { ownerId, machineId, action: "start" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("conflict");
	});

	it("records funding as the new total the machine may spend", async () => {
		const db = fakeDatabase([{ id: machineId }], [funded], written());
		const result = await actOnMachine(db, {
			ownerId,
			machineId,
			action: "fund",
			budgetGranted: 2500n,
		});

		expect(result).toEqual({ ok: true, value: { state: "ready" } });
		expect(lastPayload(db)).toEqual({ limit: "budgetGranted", from: "1000", to: "2500" });
	});

	it("records what the owner asked for and answers with the new state", async () => {
		const db = fakeDatabase([{ id: machineId }], [funded], written());
		const result = await actOnMachine(db, { ownerId, machineId, action: "start" });

		expect(result).toEqual({ ok: true, value: { state: "running" } });
		expect(lastStatement(db)).toContain("machine.started");
	});

	it("says so rather than claiming success when the record writes nothing", async () => {
		const db = fakeDatabase([{ id: machineId }], [funded], []);
		const result = await actOnMachine(db, { ownerId, machineId, action: "start" });

		// An owner's action is not fenced by a node's lease, so nothing being written is not a conflict
		// with another writer: it means the insert itself did not happen.
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("internal");
	});

	it("stops a machine on the owner's say so", async () => {
		const db = fakeDatabase([{ id: machineId }], [funded, started], written());
		const result = await actOnMachine(db, { ownerId, machineId, action: "stop" });

		expect(result).toEqual({ ok: true, value: { state: "stopped" } });
		expect(lastStatement(db)).toContain("machine.stopped");
	});

	it("pauses a running machine, saying the owner asked", async () => {
		const db = fakeDatabase([{ id: machineId }], [funded, started], written());
		const result = await actOnMachine(db, { ownerId, machineId, action: "pause" });

		expect(result).toEqual({ ok: true, value: { state: "paused" } });
		expect(lastStatement(db)).toContain("machine.paused");
	});
});
