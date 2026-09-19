import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { signerRecord } from "./signer-record.ts";

// The behaviour against a real database is proved in packages/integration-tests. These cover the
// guards: what happens when there is no held run, and how the database's answers are read.

const request = {
	proposalId: newId<"proposal">(),
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	machineId: newId<"machine">(),
	wallet: "WaLLet1111111111111111111111111111111111111",
	transaction: "AAAA",
	lastValidBlockHeight: "1000",
	trade: {
		inputMint: "So11111111111111111111111111111111111111112",
		outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		inputAmount: "100000",
		quotedOutputAmount: "14000000",
		minimumOutputAmount: "13900000",
		slippageBps: 50,
		router: "jupiter",
	},
};

/** A database that answers each statement with the next set of rows. */
function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { execute, transaction: vi.fn() } as unknown as Database;
}

const record = (db: Database) =>
	signerRecord(db, { feeAllowance: 10_000n, now: () => new Date("2026-09-21T15:00:00Z") });

describe("signerRecord without a held run", () => {
	it("knows nothing, and holds nothing", async () => {
		expect(await record(fakeDatabase()).factsFor(request)).toBeUndefined();
		expect(await record(fakeDatabase()).hold(request)).toBeUndefined();
	});

	it("refuses to write anything", async () => {
		await expect(
			record(fakeDatabase()).recordRefusal(request, { rule: "budget", reason: "x" }),
		).rejects.toThrow(/no held run/);
		await expect(record(fakeDatabase()).pauseMachine(request, "other", "x")).rejects.toThrow(
			/no held run/,
		);
		await expect(record(fakeDatabase()).giveBack(request, "x")).rejects.toThrow(/no held run/);
	});
});

describe("signerRecord with a held run", () => {
	it("reads a machine with no history as a draft with nothing to spend", async () => {
		const lease = { lease_epoch: "3", due_at: "2026-09-21T15:00:00.000Z" };
		const facts = await record(fakeDatabase([lease], [], [])).factsFor(request);
		expect(facts).toEqual({
			state: "draft",
			limits: { maxPerTrade: undefined, maxPerDay: undefined, approvedMints: [] },
			availableBudget: 0n,
			spentToday: 0n,
			dueAt: new Date("2026-09-21T15:00:00.000Z"),
		});
	});

	it("accepts a due time the driver already turned into a date", async () => {
		const due = new Date("2026-09-21T15:00:00.000Z");
		const facts = await record(fakeDatabase([{ lease_epoch: 3, due_at: due }], [], [])).factsFor(
			request,
		);
		expect(facts?.dueAt).toEqual(due);
	});

	it("treats a fault while holding as a fault, not as a refusal", async () => {
		const lease = { lease_epoch: "3", due_at: "2026-09-21T15:00:00.000Z" };
		const nothing = { ...request, trade: { ...request.trade, inputAmount: "0" } };
		await expect(record(fakeDatabase([lease])).hold(nothing)).rejects.toThrow(/more than nothing/);
	});
});

describe("signerRecord writing under the lease", () => {
	const lease = { lease_epoch: "3", due_at: "2026-09-21T15:00:00.000Z" };
	const written = [{ id: newId<"event">(), occurred_at: "2026-09-21T15:00:01.000Z" }];

	it("writes a refusal, a pause and a release when the record accepts them", async () => {
		await expect(
			record(fakeDatabase([lease], written)).recordRefusal(request, {
				rule: "per_trade_cap",
				reason: "too big",
				by: "provider",
			}),
		).resolves.toBeUndefined();
		await expect(
			record(fakeDatabase([lease], written)).pauseMachine(request, "budget_exhausted", "empty"),
		).resolves.toBeUndefined();
		await expect(
			record(fakeDatabase([lease], written)).giveBack(request, "refused"),
		).resolves.toBeUndefined();
	});

	it("passes on the record refusing a write, rather than pretending it happened", async () => {
		// No rows back means a newer lease has written for the machine.
		await expect(
			record(fakeDatabase([lease], [])).recordRefusal(request, { rule: "budget", reason: "x" }),
		).rejects.toThrow(/newer lease/);
		await expect(
			record(fakeDatabase([lease], [])).pauseMachine(request, "other", "x"),
		).rejects.toThrow(/newer lease/);
		await expect(record(fakeDatabase([lease], [])).giveBack(request, "x")).rejects.toThrow(
			/newer lease/,
		);
	});
});

describe("signerRecord after a trade is signed", () => {
	const lease = { lease_epoch: "3", due_at: "2026-09-21T15:00:00.000Z" };
	const written = [{ id: newId<"event">(), occurred_at: "2026-09-21T15:00:01.000Z" }];
	const cost = { inputAmount: 1n, outputAmount: 2n, feeLamports: 3n };

	it("reads the provider's wallet id, or nothing", async () => {
		expect(await record(fakeDatabase([{ provider_wallet_id: "w-1" }])).walletIdFor(request)).toBe(
			"w-1",
		);
		expect(await record(fakeDatabase([])).walletIdFor(request)).toBeUndefined();
	});

	it("refuses to write without a run to write for", async () => {
		const submission = { signature: "5".repeat(88), lastValidBlockHeight: 1n };
		await expect(record(fakeDatabase()).recordSubmission(request, submission)).rejects.toThrow(
			/no held run/,
		);
		await expect(record(fakeDatabase()).settle(request, "sig", cost)).rejects.toThrow(
			/no held run/,
		);
		await expect(record(fakeDatabase()).release(request, "submit", "x", "sig")).rejects.toThrow(
			/no held run/,
		);
	});

	it("settles and releases when the record accepts them, and says so when it does not", async () => {
		const signature = "5".repeat(88);
		await expect(
			record(fakeDatabase([lease], written)).settle(request, signature, cost),
		).resolves.toBeUndefined();
		await expect(
			record(fakeDatabase([lease], written)).release(request, "confirm", "expired", signature),
		).resolves.toBeUndefined();
		await expect(
			record(fakeDatabase([lease], [])).settle(request, signature, cost),
		).rejects.toThrow(/newer lease/);
		await expect(
			record(fakeDatabase([lease], [])).release(request, "confirm", "expired", signature),
		).rejects.toThrow(/newer lease/);
	});
});
