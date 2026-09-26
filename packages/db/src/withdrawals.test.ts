import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { machineForWithdrawal, withdrawalSubmission } from "./withdrawals.ts";

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
