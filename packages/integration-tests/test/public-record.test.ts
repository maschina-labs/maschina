/**
 * The public record, read from a real database.
 *
 * This file exists because of a bug a fake database could never have caught. The query that fetches
 * the intents belonging to a set of finished trades was written as `= any(${tradeIds}::text[])`,
 * which Drizzle expands into `($2, $3, $4)`, a record, and Postgres refuses to cast a record to
 * `text[]`. The unit tests feed `readOwnerPublicEvents` canned rows and never run the SQL, so they
 * passed. In production the route answered 500 for every owner who had ever completed a trade, and
 * because the environment variable that turns the record on had never been set, nobody saw it
 * (MISTAKES M48).
 *
 * So the rule for this file: anything the public record does against the database gets proved here,
 * with rows that look like the ones production holds.
 */

import { newId } from "@maschina/core";
import {
	createDatabase,
	createOwner,
	type DatabaseHandle,
	readOwnerPublicEvents,
	writeMachine,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;
let sql: postgres.Sql;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "public-record-test" });
	sql = postgres(database.appUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
	await sql?.end();
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** The owner row, made the way signing in makes it, before any machine is written. */
async function ownerIdFor(walletAddress: string) {
	const owner = await createOwner(handle.db, walletAddress);
	if (!owner.ok) throw owner.error;
	return owner.value.id;
}

async function aMachineFor(ownerWallet: string, paper: boolean) {
	const ownerId = await ownerIdFor(ownerWallet);
	const written = await writeMachine(handle.db, {
		ownerId,
		name: paper ? "Paper runner" : "Range Finder",
		kind: "price_trigger",
		paper,
		settings: { spendMint: USDC, buyMint: SOL, level: "142000000", direction: "falls_to" },
		rules: {},
		wallet: { address: address(), providerWalletId: `wallet-${address()}`, provider: "turnkey" },
		limits: { budgetGranted: 20_000_000n, maxPerTrade: 5_000_000n, approvedMints: [SOL, USDC] },
	});
	if (!written.ok) throw written.error;
	return written.value;
}

/**
 * One finished trade, written the way the ledger writes it: the intent first, then what happened.
 * Straight SQL, because the point is the shape of the rows, not the path that writes them.
 */
async function aFinishedTrade(machineId: string, runId: string, done: "completed" | "simulated") {
	const tradeId = newId<"trade">();
	const intent = {
		runId,
		tradeId,
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: "1000000",
		quotedOutputAmount: "7000000",
		slippageBps: 50,
		feeAllowance: "5000",
	};
	const outcome =
		done === "completed"
			? {
					runId,
					tradeId,
					signature: "5".repeat(88),
					inputAmount: "1000000",
					outputAmount: "7000000",
					feeLamports: "5000",
				}
			: { runId, tradeId, inputAmount: "1000000", outputAmount: "7000000" };
	await sql`
		insert into events (machine_id, type, payload, lease_epoch)
		values (${machineId}, 'trade.intended', ${sql.json(intent)}, 1),
		       (${machineId}, ${`trade.${done}`}, ${sql.json(outcome)}, 1)`;
	return tradeId;
}

describe("reading an owner's public record", () => {
	it("is empty for an owner with nothing", async () => {
		const owner = await aMachineFor(address(), false);

		expect(await readOwnerPublicEvents(handle.db, owner.ownerId, 50)).toEqual([]);
	});

	it("returns a finished trade with the intent that led to it", async () => {
		const owner = await aMachineFor(address(), false);
		const runId = newId<"run">();
		const tradeId = await aFinishedTrade(owner.machineId, runId, "completed");

		const events = await readOwnerPublicEvents(handle.db, owner.ownerId, 50);

		// Oldest first: an intent has to arrive before the completion it belongs to.
		expect(events.map((event) => event.type)).toEqual(["trade.intended", "trade.completed"]);
		for (const event of events)
			expect((event.payload as { tradeId?: string }).tradeId).toBe(tradeId);
	});

	it("returns many finished trades at once, which is the case that used to fail", async () => {
		// Eight, because eight is what production had when the route answered 500 for every request.
		const owner = await aMachineFor(address(), false);
		const expected = [];
		for (let index = 0; index < 8; index += 1)
			expected.push(await aFinishedTrade(owner.machineId, newId<"run">(), "completed"));

		const events = await readOwnerPublicEvents(handle.db, owner.ownerId, 50);

		expect(events.filter((event) => event.type === "trade.completed")).toHaveLength(8);
		expect(events.filter((event) => event.type === "trade.intended")).toHaveLength(8);
		const ids = new Set(events.map((event) => (event.payload as { tradeId?: string }).tradeId));
		for (const tradeId of expected) expect(ids).toContain(tradeId);
	});

	it("covers every machine the owner has, paper and real money alike", async () => {
		const ownerWallet = address();
		const real = await aMachineFor(ownerWallet, false);
		const paper = await aMachineFor(ownerWallet, true);
		await aFinishedTrade(real.machineId, newId<"run">(), "completed");
		await aFinishedTrade(paper.machineId, newId<"run">(), "simulated");

		const events = await readOwnerPublicEvents(handle.db, real.ownerId, 50);

		expect(events.filter((event) => event.type === "trade.completed")).toHaveLength(1);
		expect(events.filter((event) => event.type === "trade.simulated")).toHaveLength(1);
	});

	it("shows one owner nothing of another owner's", async () => {
		const mine = await aMachineFor(address(), false);
		const theirs = await aMachineFor(address(), false);
		await aFinishedTrade(theirs.machineId, newId<"run">(), "completed");

		expect(await readOwnerPublicEvents(handle.db, mine.ownerId, 50)).toEqual([]);
	});
});
