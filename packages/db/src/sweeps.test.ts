import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { floatFor, machineForSweep, sweepRequested, sweepSubmission } from "./sweeps.ts";

const machineId = newId<"machine">();
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const VAULT = "CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt";

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { database: { execute } as unknown as Database, execute };
}

/** A range machine spending USDC, as the database would return it. */
const machineRow = (over: Record<string, unknown> = {}) => ({
	wallet_address: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
	vault_address: VAULT,
	provider_wallet_id: "wallet-9f2c",
	paper: false,
	kind: "range",
	settings: {
		quoteMint: USDC,
		baseMint: SOL,
		buyLevel: "140000000",
		sellLevel: "150000000",
		amountPerBuy: "15000000",
	},
	...over,
});

const event = (type: string, payload: object) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type,
	payload,
	occurred_at: "2026-09-27T09:00:00.000Z",
});

describe("a machine as a sweep sees it", () => {
	it("has its vault and the currency its float is counted in", async () => {
		const { database } = fakeDatabase([machineRow()]);

		expect(await machineForSweep(database, machineId)).toEqual({
			wallet: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
			vault: VAULT,
			providerWalletId: "wallet-9f2c",
			budgetMint: USDC,
			paper: false,
		});
	});

	it("has no vault when it was made before vaults", async () => {
		const { database } = fakeDatabase([machineRow({ vault_address: null })]);

		expect(await machineForSweep(database, machineId)).not.toHaveProperty("vault");
	});

	it("is nothing when there is no such machine", async () => {
		const { database } = fakeDatabase([]);
		expect(await machineForSweep(database, machineId)).toBeUndefined();
	});

	it("reads the vault from the machine, never from the caller", async () => {
		const { database, execute } = fakeDatabase([]);
		await machineForSweep(database, machineId);

		expect(JSON.stringify(execute.mock.calls[0])).toContain("vault_address");
	});
});

describe("a machine's float, from the record and a holding", () => {
	it("is due for a sweep when the holding is above the grant by more than the threshold", async () => {
		const { database } = fakeDatabase(
			[machineRow()],
			[event("machine.limits_changed", { limit: "budgetGranted", from: null, to: "50000000" })],
		);

		const float = await floatFor(database, machineId, 51_500_000n);

		expect(float.target).toBe(50_000_000n);
		expect(float.sweep).toMatchObject({ sweep: true, amount: 1_500_000n });
	});

	it("is not due while a trade is in flight", async () => {
		const { database } = fakeDatabase(
			[machineRow()],
			[
				event("machine.limits_changed", { limit: "budgetGranted", from: null, to: "50000000" }),
				event("trade.intended", {
					runId: newId<"run">(),
					tradeId: newId<"trade">(),
					inputMint: USDC,
					outputMint: SOL,
					inputAmount: "15000000",
					quotedOutputAmount: "100000000",
				}),
			],
		);

		expect((await floatFor(database, machineId, 55_000_000n)).sweep.sweep).toBe(false);
	});
});

describe("a sweep's signature", () => {
	const sweepId = newId<"sweep">();
	const submitted = (id: string) =>
		event("sweep.submitted", {
			sweepId: id,
			signature: "5".repeat(88),
			lastValidBlockHeight: "426070577",
		});

	it("is found when one was already written down, so nothing is signed twice", async () => {
		const { database } = fakeDatabase([submitted(sweepId)]);

		expect(await sweepSubmission(database, machineId, sweepId)).toEqual({
			signature: "5".repeat(88),
			lastValidBlockHeight: 426_070_577n,
		});
	});

	it("belongs to one sweep only", async () => {
		const { database } = fakeDatabase([submitted(newId<"sweep">())]);
		expect(await sweepSubmission(database, machineId, sweepId)).toBeUndefined();
	});
});

describe("what a sweep decided", () => {
	const sweepId = newId<"sweep">();
	const requested = (id: string) =>
		event("sweep.requested", {
			sweepId: id,
			to: VAULT,
			mint: USDC,
			amount: "1500000",
			value: "51500000",
			floatTarget: "50000000",
		});

	it("is read back exactly, so a sweep can be finished without deciding again", async () => {
		const { database } = fakeDatabase([requested(sweepId)]);
		expect(await sweepRequested(database, machineId, sweepId)).toEqual({
			to: VAULT,
			mint: USDC,
			amount: 1_500_000n,
		});
	});

	it("belongs to one sweep only", async () => {
		const { database } = fakeDatabase([requested(newId<"sweep">())]);
		expect(await sweepRequested(database, machineId, sweepId)).toBeUndefined();
	});
});
