/**
 * What the signer reads from the record and writes back, against real Postgres.
 *
 * The signer never takes a machine's word for anything. Its limits, its budget, its state and the run
 * it is acting for all come from the record, at the moment of asking. These tests build a machine the
 * way the record would, then check what the signer sees and what it leaves behind.
 */

import { newId } from "@maschina/core";
import {
	appendEvent,
	budgetFor,
	claimDueRun,
	createDatabase,
	type DatabaseHandle,
	queueRun,
	readMachineEvents,
	saveDefinition,
	signerRecord,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "signer-record-test" });
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
const FEE = 10_000n;

/** A running machine with a budget and limits, and one run leased to a node. */
async function aRunningMachine(options: { granted?: bigint; running?: boolean } = {}) {
	const sql = handle.sql;
	const wallet = address();
	// Given a v7 id, as every id in the record must be. The column's own default is v4 (#551).
	const ownerId = newId<"owner">();
	await sql`insert into owners (id, wallet_address) values (${ownerId}::uuid, ${address()})`;
	const saved = await saveDefinition(handle.db, {
		kind: "recurring_buy",
		settings: { amount: address() },
		rules: {},
	});
	if (!saved.ok) throw new Error("could not set up the test");
	const machineId = newId<"machine">();
	await sql`
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider, definition_id, name)
		values (${machineId}::uuid, ${ownerId}::uuid, ${wallet}, ${"wallet-1"}, ${"turnkey"},
			${saved.value.id}, ${"Weekly SOL"})`;

	const events = [
		{
			type: "machine.created",
			payload: { ownerId, definitionVersionId: "a".repeat(64), walletAddress: wallet },
		},
		{
			type: "machine.limits_changed",
			payload: { limit: "budgetGranted", from: null, to: String(options.granted ?? 1_000_000n) },
		},
		{ type: "machine.limits_changed", payload: { limit: "maxPerTrade", from: null, to: "500000" } },
		{
			type: "machine.limits_changed",
			payload: { limit: "approvedMints", from: null, to: `${SOL},${USDC}` },
		},
		...(options.running === false ? [] : [{ type: "machine.started", payload: {} }]),
	];
	for (const event of events) {
		const written = await appendEvent(handle.db, { machineId, leaseEpoch: 0n, ...event });
		if (!written.ok) throw written.error;
	}

	const now = new Date();
	await queueRun(handle.db, { machineId, occurrenceKey: newId<"run">(), dueAt: now });
	const claimed = await claimDueRun(handle.db, { nodeId: newId<"node">(), now, leaseSeconds: 60 });
	if (!claimed.ok || claimed.value?.machineId !== machineId) throw new Error("could not claim");
	return { machineId, wallet, run: claimed.value };
}

const aRequest = (
	machine: Awaited<ReturnType<typeof aRunningMachine>>,
	inputAmount = "100000",
) => ({
	proposalId: newId<"proposal">(),
	runId: machine.run.id,
	tradeId: newId<"trade">(),
	machineId: machine.machineId,
	wallet: machine.wallet,
	transaction: "AAAA",
	lastValidBlockHeight: "1000",
	trade: {
		inputMint: SOL,
		outputMint: USDC,
		inputAmount,
		quotedOutputAmount: "14000000",
		minimumOutputAmount: "13900000",
		slippageBps: 50,
		router: "jupiter",
	},
});

const record = () => signerRecord(handle.db, { feeAllowance: FEE });

describe("what the signer reads", () => {
	it("gives the machine's state, limits, budget and the run's due time", async () => {
		const machine = await aRunningMachine();
		const facts = await record().factsFor(aRequest(machine));

		expect(facts).toMatchObject({
			state: "running",
			limits: { maxPerTrade: 500_000n, approvedMints: [SOL, USDC] },
			availableBudget: 1_000_000n,
			spentToday: 0n,
			dueAt: machine.run.dueAt,
		});
	});

	it("knows nothing of a request whose wallet is not the machine's", async () => {
		const machine = await aRunningMachine();
		expect(await record().factsFor({ ...aRequest(machine), wallet: address() })).toBeUndefined();
	});

	it("knows nothing of a run that belongs to another machine", async () => {
		const machine = await aRunningMachine();
		const other = await aRunningMachine();
		expect(await record().factsFor({ ...aRequest(machine), runId: other.run.id })).toBeUndefined();
	});

	it("knows nothing of a run no node holds any more", async () => {
		const machine = await aRunningMachine();
		await handle.sql`update runs set state = 'done', leased_by = null, lease_expires_at = null
			where id = ${machine.run.id}::uuid`;
		expect(await record().factsFor(aRequest(machine))).toBeUndefined();
	});

	it("reports a machine that was never started as it is", async () => {
		const machine = await aRunningMachine({ running: false });
		expect((await record().factsFor(aRequest(machine)))?.state).not.toBe("running");
	});
});

describe("what the signer writes", () => {
	it("records a refusal under the run's lease", async () => {
		const machine = await aRunningMachine();
		const request = aRequest(machine);
		await record().recordRefusal(request, { rule: "per_trade_cap", reason: "too big" });

		const events = await readMachineEvents(handle.db, machine.machineId);
		expect(events.at(-1)).toMatchObject({
			type: "trade.refused",
			payload: { tradeId: request.tradeId, by: "maschina", rule: "per_trade_cap" },
		});
	});

	it("pauses the machine", async () => {
		const machine = await aRunningMachine();
		await record().pauseMachine(aRequest(machine), "budget_exhausted", "nothing left");

		const events = await readMachineEvents(handle.db, machine.machineId);
		expect(events.at(-1)).toMatchObject({
			type: "machine.paused",
			payload: { reason: "budget_exhausted", detail: "nothing left" },
		});
	});

	it("holds the amount plus the fee allowance, and gives it back", async () => {
		const machine = await aRunningMachine();
		const request = aRequest(machine, "100000");

		expect(await record().hold(request)).toEqual({ reserved: 110_000n });
		expect((await budgetFor(handle.db, machine.machineId)).available).toBe(890_000n);

		await record().giveBack(request, "refused by provider");
		expect((await budgetFor(handle.db, machine.machineId)).available).toBe(1_000_000n);
	});

	it("holds nothing when the budget cannot cover the trade", async () => {
		const machine = await aRunningMachine({ granted: 50_000n });
		expect(await record().hold(aRequest(machine, "100000"))).toBeUndefined();
	});
});
