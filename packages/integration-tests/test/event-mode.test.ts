/**
 * Paper and real money cannot be confused in the record, and the database is what guarantees it.
 *
 * The mode of an event is never supplied by the caller. It is read from the machine's own `paper`
 * flag in the same statement that writes the event, so no code path can set it wrong and none has to
 * remember to try. The same rule refuses the two writes that would make the record lie: a machine on
 * paper producing an event that only exists because something was signed, and a machine trading real
 * money producing a simulated trade.
 *
 * All of it is proved against real Postgres, as both roles, because a guarantee the application
 * enforces is a convention and a guarantee the database enforces is a guarantee.
 */

import { newId } from "@maschina/core";
import {
	appendOwnerEvent,
	createDatabase,
	type DatabaseHandle,
	saveDefinition,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;
let sql: postgres.Sql;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "event-mode-test" });
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

/** A machine that exists, said to be on paper or not. Nothing here goes near a wallet. */
async function aMachine(paper: boolean) {
	const ownerId = newId<"owner">();
	const machineId = newId<"machine">();
	await sql`insert into owners (id, wallet_address) values (${ownerId}::uuid, ${address()})`;
	const saved = await saveDefinition(handle.db, {
		kind: "range",
		settings: { quoteMint: USDC, baseMint: SOL, buyLevel: "1", sellLevel: "2", amountPerBuy: "1" },
		rules: {},
	});
	if (!saved.ok) throw saved.error;
	await sql`
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider,
			definition_id, name, paper)
		values (${machineId}::uuid, ${ownerId}::uuid, ${address()}, ${"wallet-1"}, ${"turnkey"},
			${saved.value.id}, ${"A machine"}, ${paper})`;
	return machineId;
}

const modeOf = async (eventId: string) => {
	const [row] = await sql<{ mode: string }[]>`select mode from events where id = ${eventId}`;
	return row?.mode;
};

/**
 * Writes an event the way an owner does: no run, no lease.
 *
 * The mode trigger runs on every insert whatever wrote it, which is the point of testing it here,
 * and it keeps these tests about the mode rather than about who held which lease.
 */
const write = async (machineId: string, type: string, payload: Record<string, unknown>) =>
	appendOwnerEvent(handle.db, { machineId, type, payload } as never);

const RUN = newId<"run">();

describe("what mode an event is written in", () => {
	it("comes from the machine, for a machine on paper", async () => {
		const machineId = await aMachine(true);
		const written = await write(machineId, "machine.created", {
			ownerId: newId<"owner">(),
			definitionVersionId: "a".repeat(64),
			walletAddress: address(),
		});

		expect(written.ok).toBe(true);
		expect(await modeOf(written.ok ? written.value.id : "")).toBe("paper");
	});

	it("comes from the machine, for a machine trading real money", async () => {
		const machineId = await aMachine(false);
		const written = await write(machineId, "machine.created", {
			ownerId: newId<"owner">(),
			definitionVersionId: "a".repeat(64),
			walletAddress: address(),
		});

		expect(written.ok).toBe(true);
		expect(await modeOf(written.ok ? written.value.id : "")).toBe("live");
	});

	it("ignores a mode the caller tries to supply, including through raw SQL", async () => {
		// The only answer is the machine's. Nothing that writes an event gets a say, which is the
		// whole point: a convention can be broken by one wrong branch, this cannot.
		const machineId = await aMachine(true);
		const [row] = await sql<{ id: string; mode: string }[]>`
			insert into events (machine_id, type, payload, lease_epoch, mode)
			values (${machineId}::uuid, 'machine.started', ${sql.json({ runId: RUN })}, 0, 'live')
			returning id, mode`;

		expect(row?.mode).toBe("paper");
	});
});

describe("what a machine on paper may never write", () => {
	it.each(["trade.submitted", "trade.completed", "trade.failed"])(
		"refuses %s, because a machine on paper signs nothing",
		async (type) => {
			const machineId = await aMachine(true);
			await expect(
				sql`
					insert into events (machine_id, type, payload, lease_epoch)
					values (${machineId}::uuid, ${type}, ${sql.json({})}, 0)`,
			).rejects.toThrow(/signs nothing/);
		},
	);

	it("still lets it intend and simulate a trade, which is all paper ever does", async () => {
		const machineId = await aMachine(true);
		const intended = await write(machineId, "trade.intended", {
			runId: RUN,
			tradeId: newId<"trade">(),
			inputMint: USDC,
			outputMint: SOL,
			inputAmount: "5000000",
			quotedOutputAmount: "40000",
			slippageBps: 50,
		});

		expect(intended.ok).toBe(true);
		expect(await modeOf(intended.ok ? intended.value.id : "")).toBe("paper");
	});
});

describe("what a machine trading real money may never write", () => {
	it("refuses a simulated trade, because real money is not simulated", async () => {
		const machineId = await aMachine(false);
		await expect(
			sql`
				insert into events (machine_id, type, payload, lease_epoch)
				values (${machineId}::uuid, 'trade.simulated', ${sql.json({})}, 0)`,
		).rejects.toThrow(/never simulates/);
	});
});

describe("whether a machine is on paper", () => {
	it("cannot be changed afterwards, by either role", async () => {
		// Every event a machine ever wrote took its mode from this column. If it could be flipped, all
		// of that history would describe a machine that no longer exists.
		const machineId = await aMachine(true);

		await expect(
			sql`update machines set paper = false where id = ${machineId}::uuid`,
		).rejects.toThrow(/made on paper or with money and never changes/);

		const owner = postgres(database.ownerUrl, { max: 1, onnotice: () => {} });
		try {
			await expect(
				owner`update machines set paper = false where id = ${machineId}::uuid`,
			).rejects.toThrow(/made on paper or with money and never changes/);
		} finally {
			await owner.end();
		}

		const [row] = await sql<{ paper: boolean }[]>`
			select paper from machines where id = ${machineId}::uuid`;
		expect(row?.paper).toBe(true);
	});

	it("has to be said: the column offers no answer of its own", async () => {
		const ownerId = newId<"owner">();
		await sql`insert into owners (id, wallet_address) values (${ownerId}::uuid, ${address()})`;
		const saved = await saveDefinition(handle.db, {
			kind: "range",
			settings: {
				quoteMint: USDC,
				baseMint: SOL,
				buyLevel: "1",
				sellLevel: "2",
				amountPerBuy: "1",
			},
			rules: {},
		});
		if (!saved.ok) throw saved.error;

		await expect(
			sql`
				insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider,
					definition_id, name)
				values (${newId<"machine">()}::uuid, ${ownerId}::uuid, ${address()}, ${"wallet-1"},
					${"turnkey"}, ${saved.value.id}, ${"Unsaid"})`,
		).rejects.toThrow(/null value in column "paper"/);
	});
});
