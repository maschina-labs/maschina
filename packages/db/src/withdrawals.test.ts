import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { machineForWithdrawal, machineStateOf, withdrawalSubmission } from "./withdrawals.ts";

const machineId = newId<"machine">();

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { database: { execute } as unknown as Database, execute };
}

describe("who a machine's funds belong to", () => {
	it("is the owner's own wallet, read alongside the machine's", async () => {
		const { database } = fakeDatabase([
			{
				wallet_address: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
				owner_wallet: "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu",
				provider_wallet_id: "wallet-9f2c",
			},
		]);

		expect(await machineForWithdrawal(database, machineId)).toEqual({
			wallet: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
			ownerWallet: "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu",
			providerWalletId: "wallet-9f2c",
		});
	});

	it("is nothing for a machine that does not exist", async () => {
		const { database } = fakeDatabase([]);

		expect(await machineForWithdrawal(database, machineId)).toBeUndefined();
	});

	it("reads the owner through the machine, never from the caller", async () => {
		const { database, execute } = fakeDatabase([]);

		await machineForWithdrawal(database, machineId);

		const sql = JSON.stringify(execute.mock.calls[0]);
		expect(sql).toContain("owners");
		expect(sql).toContain("join");
	});
});

describe("a withdrawal's signature", () => {
	const withdrawalId = newId<"withdrawal">();
	const submitted = (id: string) => ({
		id: newId<"event">(),
		machine_id: machineId,
		type: "withdrawal.submitted",
		payload: { withdrawalId: id, signature: "5".repeat(88), lastValidBlockHeight: "426070577" },
		occurred_at: "2026-09-26T09:00:00.000Z",
	});

	it("is found when one was already written down, so nothing is signed twice", async () => {
		const { database } = fakeDatabase([submitted(withdrawalId)]);

		expect(await withdrawalSubmission(database, machineId, withdrawalId)).toEqual({
			signature: "5".repeat(88),
			lastValidBlockHeight: 426_070_577n,
		});
	});

	it("belongs to one withdrawal only, never to another on the same machine", async () => {
		const { database } = fakeDatabase([submitted(newId<"withdrawal">())]);

		expect(await withdrawalSubmission(database, machineId, withdrawalId)).toBeUndefined();
	});

	it("is nothing when this withdrawal has never been signed", async () => {
		const { database } = fakeDatabase([]);

		expect(await withdrawalSubmission(database, machineId, withdrawalId)).toBeUndefined();
	});
});

describe("what state a machine is in", () => {
	const event = (type: string, payload: object) => ({
		id: newId<"event">(),
		machine_id: machineId,
		type,
		payload,
		occurred_at: "2026-09-26T09:00:00.000Z",
	});

	/** A machine is only running once it was made, given a budget, and started. */
	const running = [
		event("machine.created", {
			ownerId: newId<"owner">(),
			definitionVersionId: "d".repeat(64),
			walletAddress: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
		}),
		event("machine.limits_changed", { limit: "budgetGranted", from: null, to: "50000000" }),
		event("machine.started", {}),
	];

	it("is worked out from its record", async () => {
		const { database } = fakeDatabase([{ id: machineId }], running);

		expect(await machineStateOf(database, machineId)).toBe("running");
	});

	it("is what the record last said, so a paused machine reads as paused", async () => {
		const paused = [...running, event("machine.paused", { reason: "owner" })];
		const { database } = fakeDatabase([{ id: machineId }], paused);

		expect(await machineStateOf(database, machineId)).toBe("paused");
	});

	it("is nothing for a machine that does not exist, which is not the same as stopped", async () => {
		const { database } = fakeDatabase([]);

		// Told apart on purpose: a missing machine is a mistake, a stopped one is a state.
		expect(await machineStateOf(database, machineId)).toBeUndefined();
	});
});
