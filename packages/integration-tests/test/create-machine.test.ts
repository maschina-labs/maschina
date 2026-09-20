/**
 * Writing a machine into the record, against real Postgres.
 *
 * A machine exists only once its owner, its pinned definition, its wallet and its limits are all in the
 * database together. Half a machine is worse than none: it would be a wallet nobody owns or a row with
 * no limits, so this is one transaction and either all of it happens or none of it does.
 */

import {
	budgetFor,
	createDatabase,
	type DatabaseHandle,
	readMachineEvents,
	writeMachine,
} from "@maschina/db";
import { machineState } from "@maschina/runtime";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "create-machine-test" });
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

const aMachine = (overrides: Partial<Parameters<typeof writeMachine>[1]> = {}) => ({
	ownerWallet: address(),
	name: "SOL dip buyer",
	kind: "price_trigger",
	settings: { spendMint: USDC, buyMint: SOL, level: "142000000", direction: "falls_to" },
	rules: {},
	wallet: { address: address(), providerWalletId: "wallet-1", provider: "turnkey" },
	limits: {
		budgetGranted: 20_000_000n,
		maxPerTrade: 5_000_000n,
		maxPerDay: 10_000_000n,
		approvedMints: [SOL, USDC],
	},
	...overrides,
});

describe("writeMachine", () => {
	it("writes the owner, the definition, the machine and its limits together", async () => {
		const request = aMachine();
		const written = await writeMachine(handle.db, request);

		expect(written.ok).toBe(true);
		if (!written.ok) return;
		expect(written.value.walletAddress).toBe(request.wallet.address);

		const events = await readMachineEvents(handle.db, written.value.machineId);
		expect(events.map((event) => event.type)).toContain("machine.created");
		// A machine with a budget is ready, and waits for its owner to start it.
		expect(machineState(events).state).toBe("ready");
		expect((await budgetFor(handle.db, written.value.machineId)).granted).toBe(20_000_000n);
	});

	it("records every limit the owner set, so the rules can read them back", async () => {
		const written = await writeMachine(handle.db, aMachine());
		if (!written.ok) throw written.error;

		const limits = (await readMachineEvents(handle.db, written.value.machineId))
			.filter((event) => event.type === "machine.limits_changed")
			.map((event) => (event.type === "machine.limits_changed" ? event.payload.limit : ""));
		expect(limits.sort()).toEqual(["approvedMints", "budgetGranted", "maxPerDay", "maxPerTrade"]);
	});

	it("gives a second machine for the same owner the same owner id", async () => {
		const ownerWallet = address();
		const first = await writeMachine(handle.db, aMachine({ ownerWallet }));
		const second = await writeMachine(handle.db, aMachine({ ownerWallet }));

		expect(first.ok && second.ok && first.value.ownerId === second.value.ownerId).toBe(true);
	});

	it("refuses a wallet another machine already uses, and writes nothing", async () => {
		const wallet = { address: address(), providerWalletId: "wallet-1", provider: "turnkey" };
		const first = await writeMachine(handle.db, aMachine({ wallet }));
		const second = await writeMachine(handle.db, aMachine({ wallet }));

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(false);
		const rows = await handle.sql<{ count: string }[]>`
			select count(*)::text as count from machines where wallet_address = ${wallet.address}`;
		expect(rows[0]?.count).toBe("1");
	});

	it("refuses a machine with no budget, because a machine that cannot spend is not ready", async () => {
		const refused = await writeMachine(
			handle.db,
			aMachine({ limits: { budgetGranted: 0n, approvedMints: [SOL] } }),
		);
		expect(refused.ok).toBe(false);
	});

	it("refuses an owner address that is not an address", async () => {
		const refused = await writeMachine(handle.db, aMachine({ ownerWallet: "nope" }));
		expect(refused.ok).toBe(false);
	});
});
