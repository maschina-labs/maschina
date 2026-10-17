/**
 * A paper machine has no signing key, and the database is what says so.
 *
 * Every machine used to be provisioned the same way: a real wallet at the provider, a vault beside
 * it, and two policies pinned to the owner's own address. For a machine that only ever pretends to
 * trade that is pure cost, and it made paper impossible for anyone who had not linked a wallet,
 * because there was no address to pin a policy to. So a paper machine now carries the provider
 * `paper`: an address generated once with the key thrown away, which cannot sign because nobody
 * anywhere holds it.
 *
 * The rule that matters is the one proved here: a machine that holds real money can never carry that
 * provider. It is enforced by the database, not by the code that writes to it.
 */

import { randomBytes } from "node:crypto";
import { newId } from "@maschina/core";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let sql: postgres.Sql;

beforeAll(async () => {
	database = await createTestDatabase();
	sql = postgres(database.appUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
	await sql?.end();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

/** Somebody who signed in with an email and has never linked a wallet. */
async function aPerson() {
	const id = `user-${address()}`;
	await sql`
		insert into auth_users (id, name, email)
		values (${id}, 'A person', ${`${id}@example.com`})`;
	return id;
}

/** An owner row, with a wallet of their own or with only an email account behind them. */
async function anOwner(walletAddress: string | null) {
	const userId = walletAddress ? null : await aPerson();
	const [row] = await sql<{ id: string }[]>`
		insert into owners (id, wallet_address, user_id)
		values (${newId<"owner">()}::uuid, ${walletAddress}, ${userId})
		returning id`;
	if (!row) throw new Error("the owner was not written");
	return row.id;
}

/** The definition every machine points at. Its contents do not matter here, only that one exists. */
async function aDefinition() {
	const id = randomBytes(32).toString("hex");
	await sql`
		insert into machine_definitions (id, kind, settings, rules)
		values (${id}, 'price_trigger', ${sql.json({})}, ${sql.json({})})
		on conflict (id) do nothing`;
	return id;
}

async function aMachine(ownerId: string, provider: string, paper: boolean) {
	const definitionId = await aDefinition();
	return sql`
		insert into machines
			(id, owner_id, wallet_address, provider_wallet_id, provider, definition_id, name, paper)
		values
			(${newId<"machine">()}::uuid, ${ownerId}::uuid, ${address()}, ${`id-${address()}`},
			 ${provider}, ${definitionId}, 'A machine', ${paper})`;
}

describe("a paper machine's wallet", () => {
	it("may carry the paper provider when the machine is on paper", async () => {
		const ownerId = await anOwner(address());

		await expect(aMachine(ownerId, "paper", true)).resolves.toBeDefined();
	});

	it("is refused for a machine that holds real money, by the database itself", async () => {
		const ownerId = await anOwner(address());

		await expect(aMachine(ownerId, "paper", false)).rejects.toThrow(
			/machines_paper_provider_is_paper_only/,
		);
	});

	it("leaves the real providers alone, for paper and real money alike", async () => {
		const ownerId = await anOwner(address());

		await expect(aMachine(ownerId, "turnkey", false)).resolves.toBeDefined();
		await expect(aMachine(ownerId, "turnkey", true)).resolves.toBeDefined();
		await expect(aMachine(ownerId, "crossmint", false)).resolves.toBeDefined();
	});

	it("still refuses a provider nobody has heard of", async () => {
		const ownerId = await anOwner(address());

		await expect(aMachine(ownerId, "a-friend-of-mine", true)).rejects.toThrow(
			/machines_provider_known/,
		);
	});

	it("belongs to an owner who has no wallet of their own, which is the point of it", async () => {
		// Somebody who signed in with an email and has never linked a wallet.
		const ownerId = await anOwner(null);

		await expect(aMachine(ownerId, "paper", true)).resolves.toBeDefined();
	});
});
