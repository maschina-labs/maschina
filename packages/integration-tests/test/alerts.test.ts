/**
 * Alerts, against real Postgres: which events are worth telling an owner, and telling each one once.
 */

import { newId } from "@maschina/core";
import {
	appendOwnerEvent,
	createDatabase,
	type DatabaseHandle,
	markDelivered,
	pendingAlerts,
	writeMachine,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "alerts-test" });
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
const since = new Date(Date.now() - 60_000);

async function aRangeMachine() {
	const written = await writeMachine(handle.db, {
		ownerWallet: address(),
		name: "Range Finder",
		kind: "range",
		settings: {
			quoteMint: USDC,
			baseMint: SOL,
			buyLevel: "118800000",
			sellLevel: "121200000",
			amountPerBuy: "40350000",
		},
		rules: {},
		wallet: { address: address(), providerWalletId: "wallet-1", provider: "turnkey" },
		limits: { budgetGranted: 40_600_000n, approvedMints: [USDC, SOL] },
	});
	if (!written.ok) throw written.error;
	return written.value;
}

async function write(machineId: string, type: string, payload: object) {
	const written = await appendOwnerEvent(handle.db, { machineId, type, payload });
	if (!written.ok) throw written.error;
	return written.value.id;
}

/** A buy and then a sale, both completed, the way the record holds them. */
async function aRoundTrip(machineId: string) {
	const runId = newId<"run">();
	const buy = newId<"trade">();
	const sale = newId<"trade">();
	await write(machineId, "trade.intended", {
		runId,
		tradeId: buy,
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: "40350000",
		quotedOutputAmount: "339000000",
		slippageBps: 50,
	});
	const bought = await write(machineId, "trade.completed", {
		runId,
		tradeId: buy,
		signature: "5".repeat(88),
		inputAmount: "40350000",
		outputAmount: "339698787",
		feeLamports: "5000",
	});
	await write(machineId, "trade.intended", {
		runId,
		tradeId: sale,
		inputMint: SOL,
		outputMint: USDC,
		inputAmount: "339698787",
		quotedOutputAmount: "41300000",
		slippageBps: 50,
	});
	const sold = await write(machineId, "trade.completed", {
		runId,
		tradeId: sale,
		signature: "4".repeat(88),
		inputAmount: "339698787",
		outputAmount: "41360000",
		feeLamports: "5000",
	});
	return { bought, sold };
}

describe("alerts", () => {
	it("tells an owner about each trade, which way it went, and what it has realised", async () => {
		const machine = await aRangeMachine();
		const { bought, sold } = await aRoundTrip(machine.machineId);

		const alerts = await pendingAlerts(handle.db, {
			channel: "telegram",
			ownerIds: [machine.ownerId],
			since,
		});

		expect(alerts.map((alert) => alert.eventId)).toEqual([bought, sold]);
		expect(alerts[1]).toMatchObject({
			machineName: "Range Finder",
			type: "trade.completed",
			trade: { inputMint: SOL, outputMint: USDC, outputAmount: 41_360_000n },
			realised: 1_010_000n,
		});
	});

	it("tells each one once, on each channel", async () => {
		const machine = await aRangeMachine();
		const { bought } = await aRoundTrip(machine.machineId);
		const ask = { channel: "telegram" as const, ownerIds: [machine.ownerId], since };

		await markDelivered(handle.db, { eventId: bought, channel: "telegram" });
		await markDelivered(handle.db, { eventId: bought, channel: "telegram" });

		expect((await pendingAlerts(handle.db, ask)).map((alert) => alert.eventId)).not.toContain(
			bought,
		);
	});

	it("tells a machine pausing itself, but not the owner pausing it", async () => {
		const machine = await aRangeMachine();
		await write(machine.machineId, "machine.paused", { reason: "owner" });
		const itself = await write(machine.machineId, "machine.paused", {
			reason: "repeated_failures",
			detail: "three runs failed the same way",
		});

		const alerts = await pendingAlerts(handle.db, {
			channel: "telegram",
			ownerIds: [machine.ownerId],
			since,
		});

		expect(alerts.map((alert) => [alert.eventId, alert.reason])).toEqual([
			[itself, "three runs failed the same way"],
		]);
	});

	it("tells nobody about somebody else's machine, or anything older than asked", async () => {
		const mine = await aRangeMachine();
		const theirs = await aRangeMachine();
		await aRoundTrip(theirs.machineId);

		expect(
			await pendingAlerts(handle.db, {
				channel: "telegram",
				ownerIds: [mine.ownerId],
				since,
			}),
		).toEqual([]);
		expect(
			await pendingAlerts(handle.db, {
				channel: "telegram",
				ownerIds: [theirs.ownerId],
				since: new Date(Date.now() + 60_000),
			}),
		).toEqual([]);
	});
});
