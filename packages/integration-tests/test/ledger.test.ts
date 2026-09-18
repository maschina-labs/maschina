/**
 * The budget, against a real database and real concurrency.
 *
 * A budget is only a limit if two trades cannot both spend the last of it. That cannot be proved with
 * fakes: it depends on what Postgres does when several transactions reach for the same machine at the
 * same moment, so these tests fire real trades at a real machine and add up what got through.
 */

import { newId } from "@maschina/core";
import {
	appendEvent,
	budgetFor,
	createDatabase,
	type DatabaseHandle,
	releaseTrade,
	reserveForTrade,
	saveDefinition,
	settleTrade,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "ledger-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIGNATURE = "5".repeat(88);

/** A machine with a budget its owner granted. */
async function aMachineWith(granted: bigint) {
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

	const granting = await appendEvent(handle.db, {
		machineId,
		type: "machine.limits_changed",
		leaseEpoch: 1n,
		payload: { limit: "budgetGranted", from: null, to: granted.toString() },
	});
	if (!granting.ok) throw new Error("could not grant a budget");

	return machineId;
}

const aTrade = (machineId: string, inputAmount: bigint, feeAllowance = 0n) => ({
	machineId,
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	leaseEpoch: 1n,
	inputMint: SOL,
	outputMint: USDC,
	inputAmount,
	quotedOutputAmount: 1n,
	slippageBps: 50,
	feeAllowance,
});

describe("holding budget for a trade", () => {
	it("holds what the trade spends plus what it costs to send", async () => {
		const machineId = await aMachineWith(1_000_000n);

		const held = await reserveForTrade(handle.db, aTrade(machineId, 100_000n, 5_000n));

		expect(held.ok && held.value.reserved).toBe(105_000n);
		expect(held.ok && held.value.remaining).toBe(895_000n);

		const budget = await budgetFor(handle.db, machineId);
		expect(budget.reserved).toBe(105_000n);
		expect(budget.available).toBe(895_000n);
	});

	it("refuses a trade the budget cannot cover, and holds nothing", async () => {
		const machineId = await aMachineWith(100n);

		const held = await reserveForTrade(handle.db, aTrade(machineId, 101n));

		expect(held.ok).toBe(false);
		expect(!held.ok && held.error.code).toBe("limit_exceeded");
		expect((await budgetFor(handle.db, machineId)).reserved).toBe(0n);
	});

	it("counts the fee allowance when deciding what fits", async () => {
		const machineId = await aMachineWith(100n);

		const held = await reserveForTrade(handle.db, aTrade(machineId, 100n, 1n));

		expect(held.ok).toBe(false);
		expect((await budgetFor(handle.db, machineId)).available).toBe(100n);
	});

	it("refuses a machine the record does not have", async () => {
		const held = await reserveForTrade(handle.db, aTrade(newId<"machine">(), 1n));

		expect(!held.ok && held.error.code).toBe("not_found");
	});

	it("refuses a trade from a lease that has been taken over", async () => {
		const machineId = await aMachineWith(1_000n);
		const newer = await appendEvent(handle.db, {
			machineId,
			type: "machine.started",
			leaseEpoch: 5n,
			payload: {},
		});
		expect(newer.ok).toBe(true);

		const stale = await reserveForTrade(handle.db, { ...aTrade(machineId, 10n), leaseEpoch: 2n });

		expect(!stale.ok && stale.error.code).toBe("conflict");
		expect((await budgetFor(handle.db, machineId)).reserved).toBe(0n);
	});

	it.each([
		["nothing at all", 0n, 0n],
		["a negative fee allowance", 1n, -1n],
	])("refuses a trade spending %s", async (_name, amount, fee) => {
		const machineId = await aMachineWith(1_000n);

		const held = await reserveForTrade(handle.db, aTrade(machineId, amount, fee));

		expect(held.ok).toBe(false);
	});
});

describe("settling afterwards", () => {
	it("spends what the trade really cost and gives the rest back", async () => {
		const machineId = await aMachineWith(1_000_000n);
		const trade = aTrade(machineId, 100_000n, 10_000n);
		await reserveForTrade(handle.db, trade);

		const settled = await settleTrade(handle.db, {
			machineId,
			runId: trade.runId,
			tradeId: trade.tradeId,
			leaseEpoch: 1n,
			signature: SIGNATURE,
			inputAmount: 100_000n,
			outputAmount: 5n,
			feeLamports: 5_000n,
		});

		expect(settled.ok).toBe(true);
		const budget = await budgetFor(handle.db, machineId);
		// Spent what it spent plus the real fee. The unused part of the allowance is free again.
		expect(budget.settled).toBe(105_000n);
		expect(budget.reserved).toBe(0n);
		expect(budget.available).toBe(895_000n);
	});

	it("never lets a trade settle for more than was held for it", async () => {
		const machineId = await aMachineWith(1_000n);
		const trade = aTrade(machineId, 100n, 10n);
		await reserveForTrade(handle.db, trade);

		await settleTrade(handle.db, {
			machineId,
			runId: trade.runId,
			tradeId: trade.tradeId,
			leaseEpoch: 1n,
			signature: SIGNATURE,
			inputAmount: 900n,
			outputAmount: 1n,
			feeLamports: 5n,
		});

		const budget = await budgetFor(handle.db, machineId);
		expect(budget.settled).toBe(110n);
		expect(budget.available).toBe(890n);
	});

	it("gives a reservation back for a trade that did not happen", async () => {
		const machineId = await aMachineWith(1_000n);
		const trade = aTrade(machineId, 400n, 10n);
		await reserveForTrade(handle.db, trade);

		const released = await releaseTrade(handle.db, {
			machineId,
			runId: trade.runId,
			tradeId: trade.tradeId,
			leaseEpoch: 1n,
			stage: "sign",
			reason: "the provider refused",
		});

		expect(released.ok).toBe(true);
		const budget = await budgetFor(handle.db, machineId);
		expect(budget.reserved).toBe(0n);
		expect(budget.settled).toBe(0n);
		expect(budget.available).toBe(1_000n);
	});
});

describe("many trades at once", () => {
	it("never spends more than the budget, however many arrive together", async () => {
		// Twenty trades of 100 against a budget of 1000: at most ten can be held at any moment.
		const machineId = await aMachineWith(1_000n);

		const results = await Promise.all(
			Array.from({ length: 20 }, () => reserveForTrade(handle.db, aTrade(machineId, 100n))),
		);

		const held = results.filter((result) => result.ok);
		expect(held).toHaveLength(10);

		const budget = await budgetFor(handle.db, machineId);
		expect(budget.reserved).toBe(1_000n);
		expect(budget.available).toBe(0n);
		expect(budget.reserved + budget.settled).toBeLessThanOrEqual(budget.granted);
	});

	it("holds the line with awkward amounts and a fee on each", async () => {
		// 33 + 7 each, against 500: eleven fit exactly, the twelfth does not.
		const machineId = await aMachineWith(500n);

		const results = await Promise.all(
			Array.from({ length: 30 }, () => reserveForTrade(handle.db, aTrade(machineId, 33n, 7n))),
		);

		expect(results.filter((result) => result.ok)).toHaveLength(12);
		const budget = await budgetFor(handle.db, machineId);
		expect(budget.reserved).toBe(480n);
		expect(budget.available).toBe(20n);
	});

	it("lets other machines carry on while one is being decided", async () => {
		const [first, second] = await Promise.all([aMachineWith(200n), aMachineWith(200n)]);

		const results = await Promise.all([
			...Array.from({ length: 4 }, () => reserveForTrade(handle.db, aTrade(first, 100n))),
			...Array.from({ length: 4 }, () => reserveForTrade(handle.db, aTrade(second, 100n))),
		]);

		expect(results.filter((result) => result.ok)).toHaveLength(4);
		expect((await budgetFor(handle.db, first)).available).toBe(0n);
		expect((await budgetFor(handle.db, second)).available).toBe(0n);
	});

	it("keeps holding the line as trades settle and release around it", async () => {
		const machineId = await aMachineWith(1_000n);
		const trades = Array.from({ length: 10 }, () => aTrade(machineId, 100n));

		const held = await Promise.all(trades.map((trade) => reserveForTrade(handle.db, trade)));
		expect(held.every((result) => result.ok)).toBe(true);

		// Half of them cost less than expected, half never happened at all.
		await Promise.all(
			trades.map((trade, index) =>
				index % 2 === 0
					? settleTrade(handle.db, {
							machineId,
							runId: trade.runId,
							tradeId: trade.tradeId,
							leaseEpoch: 1n,
							signature: SIGNATURE,
							inputAmount: 60n,
							outputAmount: 1n,
							feeLamports: 0n,
						})
					: releaseTrade(handle.db, {
							machineId,
							runId: trade.runId,
							tradeId: trade.tradeId,
							leaseEpoch: 1n,
							stage: "submit",
							reason: "it never landed",
						}),
			),
		);

		const budget = await budgetFor(handle.db, machineId);
		expect(budget.settled).toBe(300n);
		expect(budget.reserved).toBe(0n);
		expect(budget.available).toBe(700n);

		// And the machine can spend what came back, but not a unit more.
		const after = await Promise.all(
			Array.from({ length: 8 }, () => reserveForTrade(handle.db, aTrade(machineId, 100n))),
		);
		expect(after.filter((result) => result.ok)).toHaveLength(7);
	});
});
