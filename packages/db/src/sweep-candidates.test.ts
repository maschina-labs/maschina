import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { sweepCandidates } from "./sweep-candidates.ts";

// Against real Postgres, including the query itself, in packages/integration-tests. These pin how the
// record decides who is listed and which sweep is still open.

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { database: { execute } as unknown as Database, execute };
}

const event = (machineId: string, type: string, payload: object) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type,
	payload,
	occurred_at: "2026-09-27T09:00:00.000Z",
});

const running = (machineId: string) => [
	event(machineId, "machine.created", {
		ownerId: newId<"owner">(),
		definitionVersionId: "a".repeat(64),
		walletAddress: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
	}),
	event(machineId, "machine.limits_changed", {
		limit: "budgetGranted",
		from: null,
		to: "50000000",
	}),
	event(machineId, "machine.started", {}),
];

const submitted = (machineId: string, sweepId: string) =>
	event(machineId, "sweep.submitted", {
		sweepId,
		signature: "5".repeat(88),
		lastValidBlockHeight: "426070577",
	});

describe("the machines worth asking about", () => {
	it("lists a running machine, and names a sweep it left open", async () => {
		const machineId = newId<"machine">();
		const open = newId<"sweep">();
		const { database } = fakeDatabase(
			[{ id: machineId }],
			[...running(machineId), submitted(machineId, open)],
		);

		expect(await sweepCandidates(database)).toEqual([{ machineId, openSweepId: open }]);
	});

	it("names no sweep once the one it sent is finished", async () => {
		const machineId = newId<"machine">();
		const done = newId<"sweep">();
		const { database } = fakeDatabase(
			[{ id: machineId }],
			[
				...running(machineId),
				submitted(machineId, done),
				event(machineId, "sweep.completed", {
					sweepId: done,
					to: "CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt",
					mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					amount: "1500000",
					signature: "5".repeat(88),
					feeLamports: "5000",
					slot: "426070000",
				}),
			],
		);

		expect(await sweepCandidates(database)).toEqual([{ machineId }]);
	});

	it("leaves out a machine that is not running or paused", async () => {
		const machineId = newId<"machine">();
		const { database } = fakeDatabase(
			[{ id: machineId }],
			[...running(machineId), event(machineId, "machine.stopped", { by: "owner" })],
		);

		expect(await sweepCandidates(database)).toEqual([]);
	});

	it("asks the database for machines with a vault, off paper, and not mid-run", async () => {
		const { database, execute } = fakeDatabase([]);
		await sweepCandidates(database);

		const query = JSON.stringify(execute.mock.calls[0]);
		expect(query).toContain("vault_address is not null");
		expect(query).toContain("paper = false");
		expect(query).toContain("leased");
	});
});
