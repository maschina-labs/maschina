/**
 * Which machines are waiting on a price, against real Postgres.
 *
 * The watcher only follows prices some machine actually cares about, and only for machines that could
 * act on them. A paused machine's level is not watched, because a crossing it cannot act on is noise.
 */

import { newId } from "@maschina/core";
import {
	appendEvent,
	createDatabase,
	type DatabaseHandle,
	machinesWatchingPrices,
	saveDefinition,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "watching-test" });
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

const triggerSettings = {
	spendMint: USDC,
	buyMint: SOL,
	level: "142000000",
	direction: "falls_to",
	amountPerTrade: "5000000",
	slippageBps: 50,
};

/** A machine of a kind, in a state. */
async function aMachine(options: {
	kind: string;
	settings: Record<string, unknown>;
	state: "running" | "paused" | "draft";
}) {
	const sql = handle.sql;
	const ownerId = newId<"owner">();
	const wallet = address();
	await sql`insert into owners (id, wallet_address) values (${ownerId}::uuid, ${address()})`;
	const saved = await saveDefinition(handle.db, {
		kind: options.kind,
		settings: options.settings,
		rules: {},
	});
	if (!saved.ok) throw new Error("could not save the definition");
	const machineId = newId<"machine">();
	await sql`
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider, definition_id, name)
		values (${machineId}::uuid, ${ownerId}::uuid, ${wallet}, ${"wallet-1"}, ${"turnkey"},
			${saved.value.id}, ${"A machine"})`;

	const events: { type: string; payload: object }[] = [
		{
			type: "machine.created",
			payload: { ownerId, definitionVersionId: "a".repeat(64), walletAddress: wallet },
		},
	];
	if (options.state !== "draft") {
		// A machine is only ready once it has a budget, and only running once it has been started.
		events.push({
			type: "machine.limits_changed",
			payload: { limit: "budgetGranted", from: null, to: "20000000" },
		});
		events.push({ type: "machine.started", payload: {} });
	}
	if (options.state === "paused") {
		events.push({ type: "machine.paused", payload: { reason: "owner" } });
	}
	for (const event of events) {
		const written = await appendEvent(handle.db, { machineId, leaseEpoch: 0n, ...event });
		if (!written.ok) throw written.error;
	}
	return machineId;
}

describe("machinesWatchingPrices", () => {
	it("lists a running price trigger machine, with what it is waiting for", async () => {
		const machineId = await aMachine({
			kind: "price_trigger",
			settings: triggerSettings,
			state: "running",
		});

		const watching = await machinesWatchingPrices(handle.db);
		const mine = watching.find((machine) => machine.machineId === machineId);

		expect(mine).toMatchObject({ machineId, kind: "price_trigger", settings: triggerSettings });
	});

	it("leaves out machines that could not act on a crossing", async () => {
		const paused = await aMachine({
			kind: "price_trigger",
			settings: triggerSettings,
			state: "paused",
		});
		const draft = await aMachine({
			kind: "price_trigger",
			settings: triggerSettings,
			state: "draft",
		});

		const ids = (await machinesWatchingPrices(handle.db)).map((machine) => machine.machineId);
		expect(ids).not.toContain(paused);
		expect(ids).not.toContain(draft);
	});

	it("leaves out machines that do not watch prices at all", async () => {
		const recurring = await aMachine({
			kind: "recurring_buy",
			settings: { spendMint: USDC, buyMint: SOL, amountPerBuy: "1000000", slippageBps: 50 },
			state: "running",
		});

		const ids = (await machinesWatchingPrices(handle.db)).map((machine) => machine.machineId);
		expect(ids).not.toContain(recurring);
	});
});
