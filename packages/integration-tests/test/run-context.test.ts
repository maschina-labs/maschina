/**
 * What a node is told about a run it holds, against real Postgres.
 *
 * A node never touches the database, so everything it needs to run a machine comes from here: what kind
 * of machine it is, its settings, its wallet, whether it may act and what it may still spend. A node
 * that does not hold the run right now is told nothing.
 */

import { newId } from "@maschina/core";
import {
	appendEvent,
	claimDueRun,
	createDatabase,
	type DatabaseHandle,
	queueRun,
	runContext,
	saveDefinition,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "run-context-test" });
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
const SETTINGS = { spendMint: USDC, buyMint: SOL, amountPerBuy: "5000000", slippageBps: 50 };

async function aClaimedRun(
	options: { running?: boolean; leaseSeconds?: number; claimedAt?: Date } = {},
) {
	const sql = handle.sql;
	const wallet = address();
	const ownerId = newId<"owner">();
	await sql`insert into owners (id, wallet_address) values (${ownerId}::uuid, ${address()})`;
	const saved = await saveDefinition(handle.db, {
		kind: "recurring_buy",
		settings: SETTINGS,
		rules: {},
	});
	if (!saved.ok) throw new Error("could not save the definition");
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
			payload: { limit: "budgetGranted", from: null, to: "20000000" },
		},
		...(options.running === false ? [] : [{ type: "machine.started", payload: {} }]),
	];
	for (const event of events) {
		const written = await appendEvent(handle.db, { machineId, leaseEpoch: 0n, ...event });
		if (!written.ok) throw written.error;
	}

	const now = options.claimedAt ?? new Date();
	await queueRun(handle.db, { machineId, occurrenceKey: newId<"run">(), dueAt: now });
	const nodeId = newId<"node">();
	const claimed = await claimDueRun(handle.db, {
		nodeId,
		now,
		leaseSeconds: options.leaseSeconds ?? 60,
	});
	if (!claimed.ok || claimed.value?.machineId !== machineId) throw new Error("could not claim");
	return { machineId, wallet, nodeId, run: claimed.value };
}

const ask = (claimed: Awaited<ReturnType<typeof aClaimedRun>>, overrides: object = {}) =>
	runContext(handle.db, {
		runId: claimed.run.id,
		nodeId: claimed.nodeId,
		leaseEpoch: claimed.run.leaseEpoch,
		now: new Date(),
		...overrides,
	});

describe("runContext", () => {
	it("tells the node holding the run what it needs to run the machine", async () => {
		const claimed = await aClaimedRun();
		expect(await ask(claimed)).toEqual({
			runId: claimed.run.id,
			machineId: claimed.machineId,
			wallet: claimed.wallet,
			kind: "recurring_buy",
			settings: SETTINGS,
			dueAt: claimed.run.dueAt,
			state: "running",
			canAct: true,
			availableBudget: 20_000_000n,
			totals: { spent: 0n, buys: 0 },
		});
	});

	it("says a machine that is not running may not act", async () => {
		const claimed = await aClaimedRun({ running: false });
		expect((await ask(claimed))?.canAct).toBe(false);
	});

	it("tells a node that does not hold the run nothing", async () => {
		const claimed = await aClaimedRun();
		expect(await ask(claimed, { nodeId: newId<"node">() })).toBeUndefined();
		expect(await ask(claimed, { leaseEpoch: claimed.run.leaseEpoch + 1n })).toBeUndefined();
	});

	it("tells a node whose lease has lapsed nothing", async () => {
		const claimed = await aClaimedRun({ claimedAt: new Date(Date.now() - 120_000) });
		expect(await ask(claimed)).toBeUndefined();
		await handle.sql`update runs set state = 'done', leased_by = null, lease_expires_at = null
			where id = ${claimed.run.id}::uuid`;
	});
});
