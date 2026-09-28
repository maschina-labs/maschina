/**
 * An owner changing a machine's recipe, against real Postgres.
 *
 * The machine keeps its wallet, its money and its whole record. Only the recipe it runs changes, and the
 * change is in the record like anything else an owner does.
 */

import { newId } from "@maschina/core";
import {
	actOnMachine,
	createDatabase,
	type DatabaseHandle,
	machineForOwner,
	readMachineEvents,
	retuneMachine,
	writeMachine,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "retune-test" });
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
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

const fixedBand = {
	quoteMint: USDC,
	baseMint: SOL,
	buyLevel: "118800000",
	sellLevel: "121200000",
	amountPerBuy: "40350000",
	slippageBps: 50,
};
const following = { quoteMint: USDC, baseMint: SOL, bandBps: 100, amountPerBuy: "40350000" };

/** A range machine that has been funded, started, and then paused by its owner. */
async function aPausedRange() {
	const written = await writeMachine(handle.db, {
		ownerWallet: address(),
		name: "Range Finder",
		kind: "range",
		settings: fixedBand,
		rules: {},
		wallet: { address: address(), providerWalletId: "wallet-1", provider: "turnkey" },
		limits: { budgetGranted: 40_600_000n, maxPerTrade: 40_350_000n, approvedMints: [USDC, SOL] },
	});
	if (!written.ok) throw written.error;
	const { ownerId, machineId } = written.value;
	for (const action of ["start", "pause"] as const) {
		const done = await actOnMachine(handle.db, { ownerId, machineId, action });
		if (!done.ok) throw done.error;
	}
	return written.value;
}

describe("retuning a machine", () => {
	it("moves a paused machine onto a new recipe, and says so in its record", async () => {
		const machine = await aPausedRange();
		const before = await machineForOwner(handle.db, machine.ownerId, machine.machineId);

		const done = await retuneMachine(handle.db, {
			ownerId: machine.ownerId,
			machineId: machine.machineId,
			kind: "following_range",
			settings: following,
		});

		expect(done.ok).toBe(true);
		const after = await machineForOwner(handle.db, machine.ownerId, machine.machineId);
		expect(after).toMatchObject({ kind: "following_range", walletAddress: machine.walletAddress });
		const events = await readMachineEvents(handle.db, machine.machineId);
		const retuned = events.find((event) => event.type === "machine.retuned");
		expect(retuned?.payload).toMatchObject({ to: done.ok ? done.value.definitionId : "" });
		expect(retuned?.payload).not.toMatchObject({ from: retuned?.payload.to });
		expect(before?.state).toBe("paused");
		expect(after?.state).toBe("paused");
	});

	it("refuses while the machine is running, so no run is halfway through the old recipe", async () => {
		const machine = await aPausedRange();
		await actOnMachine(handle.db, { ...machine, action: "resume" });

		const done = await retuneMachine(handle.db, {
			...machine,
			kind: "following_range",
			settings: following,
		});

		expect(done.ok ? undefined : done.error.code).toBe("conflict");
	});

	it("finds nothing for somebody else's machine", async () => {
		const machine = await aPausedRange();

		const done = await retuneMachine(handle.db, {
			ownerId: newId<"owner">(),
			machineId: machine.machineId,
			kind: "following_range",
			settings: following,
		});

		expect(done.ok ? undefined : done.error.code).toBe("not_found");
	});

	it("refuses settings the kind cannot read", async () => {
		const machine = await aPausedRange();

		const done = await retuneMachine(handle.db, {
			...machine,
			kind: "following_range",
			settings: { ...following, bandBps: 10 },
		});

		expect(done.ok ? undefined : done.error.code).toBe("invalid_input");
	});

	it("refuses a recipe that spends a different token, because its budget is counted in the old one", async () => {
		const machine = await aPausedRange();

		const done = await retuneMachine(handle.db, {
			...machine,
			kind: "following_range",
			settings: { ...following, quoteMint: BONK },
		});

		expect(done.ok ? undefined : done.error.code).toBe("invalid_input");
	});

	it("refuses a recipe that is the one it already runs", async () => {
		const machine = await aPausedRange();

		const done = await retuneMachine(handle.db, { ...machine, kind: "range", settings: fixedBand });

		expect(done.ok ? undefined : done.error.code).toBe("invalid_input");
	});
});
