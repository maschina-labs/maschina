/**
 * The parts of the ledger that can be judged without a database.
 *
 * What cannot be judged here is the part that matters most: whether two trades can spend the same
 * money. That depends on what Postgres does under real concurrency and is proved against a real
 * database in the integration tests. This covers everything decided before the first statement runs,
 * and the shape of what comes back.
 */

import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database, Executor } from "./client.ts";
import {
	budgetFor,
	recordSubmission,
	releaseTrade,
	reserveForTrade,
	settleTrade,
	submissionFor,
} from "./ledger.ts";

const machineId = newId<"machine">();
const runId = newId<"run">();
const tradeId = newId<"trade">();
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIGNATURE = "5".repeat(88);

/** A database whose statements answer in order, and which runs a transaction inline. */
function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	const db = {
		execute,
		transaction: async (work: (tx: Executor) => Promise<unknown>) =>
			work(db as unknown as Executor),
	};
	return { db: db as unknown as Database, execute };
}

const trade = (over: Partial<Parameters<typeof reserveForTrade>[1]> = {}) => ({
	machineId,
	runId,
	tradeId,
	leaseEpoch: 1n,
	inputMint: SOL,
	outputMint: USDC,
	inputAmount: 100n,
	quotedOutputAmount: 1n,
	slippageBps: 50,
	feeAllowance: 5n,
	...over,
});

describe("what is refused before the database is touched", () => {
	it.each([
		["a trade that spends nothing", { inputAmount: 0n }],
		["a trade that spends less than nothing", { inputAmount: -1n }],
		["a negative fee allowance", { feeAllowance: -1n }],
	])("refuses %s", async (_name, over) => {
		const { db, execute } = fakeDatabase();

		const result = await reserveForTrade(db, trade(over));

		expect(result.ok).toBe(false);
		// Nothing was asked of the database, so nothing could have been locked or written.
		expect(execute).not.toHaveBeenCalled();
	});
});

describe("reserving against a record", () => {
	it("refuses a machine that does not exist", async () => {
		// The lock finds no row.
		const { db } = fakeDatabase([]);

		const result = await reserveForTrade(db, trade());

		expect(!result.ok && result.error.code).toBe("not_found");
	});

	it("refuses a trade the budget cannot cover, and says what was available", async () => {
		const { db } = fakeDatabase(
			[{ id: machineId }],
			[{ kind: "price_trigger", settings: {} }],
			[
				{
					id: newId<"event">(),
					machine_id: machineId,
					type: "machine.limits_changed",
					payload: { limit: "budgetGranted", from: null, to: "50" },
					occurred_at: "2026-09-18T00:00:00.000Z",
				},
			],
		);

		const result = await reserveForTrade(db, trade());

		expect(!result.ok && result.error.code).toBe("limit_exceeded");
		expect(!result.ok && result.error.details).toMatchObject({ wanted: "105", available: "50" });
	});

	it("reports what was held and what is left when it fits", async () => {
		const { db } = fakeDatabase(
			[{ id: machineId }],
			[{ kind: "price_trigger", settings: {} }],
			[
				{
					id: newId<"event">(),
					machine_id: machineId,
					type: "machine.limits_changed",
					payload: { limit: "budgetGranted", from: null, to: "1000" },
					occurred_at: "2026-09-18T00:00:00.000Z",
				},
			],
			[{ id: newId<"event">(), occurred_at: "2026-09-18T00:00:01.000Z" }],
		);

		const result = await reserveForTrade(db, trade());

		expect(result.ok && result.value).toEqual({ tradeId, reserved: 105n, remaining: 895n });
	});

	it("passes a refused write straight back, rather than reporting a reservation", async () => {
		const { db } = fakeDatabase(
			[{ id: machineId }],
			[{ kind: "price_trigger", settings: {} }],
			[
				{
					id: newId<"event">(),
					machine_id: machineId,
					type: "machine.limits_changed",
					payload: { limit: "budgetGranted", from: null, to: "1000" },
					occurred_at: "2026-09-18T00:00:00.000Z",
				},
			],
			// The insert writes nothing, which is how a stale lease is refused.
			[],
		);

		const result = await reserveForTrade(db, trade());

		expect(!result.ok && result.error.code).toBe("conflict");
	});
});

describe("settling and releasing", () => {
	it("writes what a trade really cost", async () => {
		const { db, execute } = fakeDatabase([
			{ id: newId<"event">(), occurred_at: "2026-09-18T00:00:02.000Z" },
		]);

		const result = await settleTrade(db, {
			machineId,
			runId,
			tradeId,
			leaseEpoch: 1n,
			signature: SIGNATURE,
			inputAmount: 100n,
			outputAmount: 5n,
			feeLamports: 5n,
		});

		expect(result.ok && result.value.tradeId).toBe(tradeId);
		expect(execute).toHaveBeenCalledTimes(1);
	});

	it("passes a refused settlement back", async () => {
		const { db } = fakeDatabase([]);

		const result = await settleTrade(db, {
			machineId,
			runId,
			tradeId,
			leaseEpoch: 1n,
			signature: SIGNATURE,
			inputAmount: 1n,
			outputAmount: 1n,
			feeLamports: 0n,
		});

		expect(!result.ok && result.error.code).toBe("conflict");
	});

	it("gives a reservation back for a trade that did not happen", async () => {
		const { db } = fakeDatabase([
			{ id: newId<"event">(), occurred_at: "2026-09-18T00:00:02.000Z" },
		]);

		const result = await releaseTrade(db, {
			machineId,
			runId,
			tradeId,
			leaseEpoch: 1n,
			stage: "sign",
			reason: "the provider refused",
		});

		expect(result.ok).toBe(true);
	});

	it("keeps the signature when a trade failed after being sent", async () => {
		const { db, execute } = fakeDatabase([
			{ id: newId<"event">(), occurred_at: "2026-09-18T00:00:02.000Z" },
		]);

		await releaseTrade(db, {
			machineId,
			runId,
			tradeId,
			leaseEpoch: 1n,
			stage: "confirm",
			reason: "it never landed",
			signature: SIGNATURE,
		});

		// The signature is what makes a failure checkable against the chain later.
		expect(JSON.stringify(execute.mock.calls)).toContain(SIGNATURE);
	});

	it("passes a refused release back", async () => {
		const { db } = fakeDatabase([]);

		const result = await releaseTrade(db, {
			machineId,
			runId,
			tradeId,
			leaseEpoch: 1n,
			stage: "submit",
			reason: "nothing happened",
		});

		expect(!result.ok && result.error.code).toBe("conflict");
	});
});

describe("reading a budget", () => {
	it("is empty for a machine with no record", async () => {
		const { db } = fakeDatabase([]);

		const budget = await budgetFor(db, machineId);

		expect(budget).toMatchObject({ granted: 0n, reserved: 0n, settled: 0n, available: 0n });
	});

	it("counts what the record says", async () => {
		const { db } = fakeDatabase(
			[{ kind: "price_trigger", settings: {} }],
			[
				{
					id: newId<"event">(),
					machine_id: machineId,
					type: "machine.limits_changed",
					payload: { limit: "budgetGranted", from: null, to: "500" },
					occurred_at: "2026-09-18T00:00:00.000Z",
				},
				{
					id: newId<"event">(),
					machine_id: machineId,
					type: "trade.intended",
					payload: {
						runId,
						tradeId,
						inputMint: SOL,
						outputMint: USDC,
						inputAmount: "100",
						quotedOutputAmount: "1",
						slippageBps: 50,
						feeAllowance: "10",
					},
					occurred_at: "2026-09-18T00:00:01.000Z",
				},
			],
		);

		const budget = await budgetFor(db, machineId);

		expect(budget.reserved).toBe(110n);
		expect(budget.available).toBe(390n);
	});
});

describe("writing down a signature before sending", () => {
	const submission = {
		machineId,
		runId,
		tradeId,
		leaseEpoch: 1n,
		signature: SIGNATURE,
		lastValidBlockHeight: 426_070_577n,
	};

	it("refuses a machine that does not exist", async () => {
		const { db } = fakeDatabase([]);

		const result = await recordSubmission(db, submission);

		expect(!result.ok && result.error.code).toBe("not_found");
	});

	it("writes the signature when this trade has none", async () => {
		const { db } = fakeDatabase(
			[{ id: machineId }],
			[],
			[{ id: newId<"event">(), occurred_at: "2026-09-18T00:00:03.000Z" }],
		);

		const result = await recordSubmission(db, submission);

		expect(result.ok && result.value.signature).toBe(SIGNATURE);
	});

	it("refuses a trade that has already been signed once, and says by what", async () => {
		const { db } = fakeDatabase(
			[{ id: machineId }],
			[
				{
					id: newId<"event">(),
					machine_id: machineId,
					type: "trade.submitted",
					payload: { runId, tradeId, signature: SIGNATURE, lastValidBlockHeight: "1" },
					occurred_at: "2026-09-18T00:00:02.000Z",
				},
			],
		);

		const result = await recordSubmission(db, submission);

		expect(!result.ok && result.error.code).toBe("conflict");
		expect(!result.ok && result.error.details).toMatchObject({ signature: SIGNATURE });
	});

	it("passes a refused write back rather than reporting a submission", async () => {
		const { db } = fakeDatabase([{ id: machineId }], [], []);

		const result = await recordSubmission(db, submission);

		expect(!result.ok && result.error.code).toBe("conflict");
	});
});

describe("finding a signature already written down", () => {
	it("finds the one belonging to this trade", async () => {
		const { db } = fakeDatabase([
			{
				id: newId<"event">(),
				machine_id: machineId,
				type: "trade.submitted",
				payload: {
					runId,
					tradeId: newId<"trade">(),
					signature: "9".repeat(88),
					lastValidBlockHeight: "1",
				},
				occurred_at: "2026-09-18T00:00:01.000Z",
			},
			{
				id: newId<"event">(),
				machine_id: machineId,
				type: "trade.submitted",
				payload: { runId, tradeId, signature: SIGNATURE, lastValidBlockHeight: "426070577" },
				occurred_at: "2026-09-18T00:00:02.000Z",
			},
		]);

		expect(await submissionFor(db, machineId, tradeId)).toEqual({
			signature: SIGNATURE,
			lastValidBlockHeight: 426_070_577n,
		});
	});

	it("says nothing when this trade was never signed", async () => {
		const { db } = fakeDatabase([]);

		expect(await submissionFor(db, machineId, tradeId)).toBeUndefined();
	});
});
