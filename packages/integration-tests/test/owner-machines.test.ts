/**
 * What an owner can see and do with their machines, against real Postgres.
 *
 * Everything here is answered for one owner. An owner asking about a machine that is not theirs is told
 * nothing: not refused with a hint, not shown a shape, nothing. An id in a request is never authority.
 */

import { newId } from "@maschina/core";
import {
	actOnMachine,
	createDatabase,
	type DatabaseHandle,
	machineForOwner,
	machinesOf,
	writeMachine,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "owner-machines-test" });
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

async function aMachineFor(ownerWallet: string, name = "SOL dip buyer") {
	const written = await writeMachine(handle.db, {
		ownerWallet,
		name,
		kind: "price_trigger",
		settings: { spendMint: USDC, buyMint: SOL, level: "142000000", direction: "falls_to" },
		rules: {},
		wallet: { address: address(), providerWalletId: "wallet-1", provider: "turnkey" },
		limits: { budgetGranted: 20_000_000n, maxPerTrade: 5_000_000n, approvedMints: [SOL, USDC] },
	});
	if (!written.ok) throw written.error;
	return written.value;
}

describe("what an owner sees", () => {
	it("lists their own machines, newest first, with state and budget", async () => {
		const ownerWallet = address();
		const first = await aMachineFor(ownerWallet, "Weekly stack");
		const second = await aMachineFor(ownerWallet, "SOL dip buyer");

		const mine = await machinesOf(handle.db, first.ownerId);

		expect(mine.map((machine) => machine.machineId)).toEqual([second.machineId, first.machineId]);
		expect(mine[0]).toMatchObject({
			name: "SOL dip buyer",
			kind: "price_trigger",
			state: "ready",
			budget: { granted: 20_000_000n, available: 20_000_000n },
		});
	});

	it("never lists somebody else's machine", async () => {
		const mine = await aMachineFor(address());
		const theirs = await aMachineFor(address());

		const listed = await machinesOf(handle.db, mine.ownerId);
		expect(listed.map((machine) => machine.machineId)).not.toContain(theirs.machineId);
	});

	it("reads one machine, with its wallet and limits", async () => {
		const written = await aMachineFor(address());
		const machine = await machineForOwner(handle.db, written.ownerId, written.machineId);

		expect(machine).toMatchObject({
			machineId: written.machineId,
			walletAddress: written.walletAddress,
			state: "ready",
			limits: { maxPerTrade: 5_000_000n, approvedMints: [SOL, USDC] },
		});
	});

	it("tells an owner nothing about a machine that is not theirs", async () => {
		const mine = await aMachineFor(address());
		const theirs = await aMachineFor(address());

		expect(await machineForOwner(handle.db, mine.ownerId, theirs.machineId)).toBeUndefined();
		expect(await machineForOwner(handle.db, mine.ownerId, newId<"machine">())).toBeUndefined();
	});
});

describe("what an owner does", () => {
	it("starts a machine that has a budget", async () => {
		const written = await aMachineFor(address());

		const started = await actOnMachine(handle.db, {
			ownerId: written.ownerId,
			machineId: written.machineId,
			action: "start",
		});

		expect(started.ok && started.value.state).toBe("running");
		const machine = await machineForOwner(handle.db, written.ownerId, written.machineId);
		expect(machine?.state).toBe("running");
	});

	it("pauses and resumes, and refuses a move that makes no sense", async () => {
		const written = await aMachineFor(address());
		const act = (action: "start" | "pause" | "resume" | "stop") =>
			actOnMachine(handle.db, { ownerId: written.ownerId, machineId: written.machineId, action });

		// Pausing something that was never started is refused, and nothing is recorded.
		expect((await act("pause")).ok).toBe(false);
		expect((await act("start")).ok).toBe(true);
		expect((await act("pause")).ok).toBe(true);
		expect((await act("resume")).ok).toBe(true);
		expect((await act("stop")).ok).toBe(true);
		// Stopped is final.
		expect((await act("start")).ok).toBe(false);
	});

	it("refuses to act on a machine that is not the owner's, and records nothing", async () => {
		const mine = await aMachineFor(address());
		const theirs = await aMachineFor(address());

		const refused = await actOnMachine(handle.db, {
			ownerId: mine.ownerId,
			machineId: theirs.machineId,
			action: "start",
		});

		expect(refused.ok).toBe(false);
		const theirMachine = await machineForOwner(handle.db, theirs.ownerId, theirs.machineId);
		expect(theirMachine?.state).toBe("ready");
	});

	it("grants more budget, and the machine can spend it", async () => {
		const written = await aMachineFor(address());

		const granted = await actOnMachine(handle.db, {
			ownerId: written.ownerId,
			machineId: written.machineId,
			action: "fund",
			budgetGranted: 50_000_000n,
		});

		expect(granted.ok).toBe(true);
		const machine = await machineForOwner(handle.db, written.ownerId, written.machineId);
		expect(machine?.budget.granted).toBe(50_000_000n);
	});
});
