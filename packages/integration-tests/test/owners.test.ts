/**
 * Owners, against real Postgres.
 *
 * Every id in the record is a v7 id, because the record's own checks refuse anything else. The owners
 * table used to hand out v4 ids by default, which meant an owner made the ordinary way could never have
 * their machine's creation recorded (#551). The database now refuses them, so it cannot come back.
 */

import { newId } from "@maschina/core";
import { createDatabase, createOwner, type DatabaseHandle } from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "owners-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

describe("createOwner", () => {
	it("makes an owner with an id the record will accept", async () => {
		const wallet = address();
		const made = await createOwner(handle.db, wallet);

		expect(made.ok).toBe(true);
		expect(made.ok && made.value.walletAddress).toBe(wallet);
		expect(made.ok && made.value.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});

	it("gives back the same owner for a wallet that already signed in", async () => {
		const wallet = address();
		const first = await createOwner(handle.db, wallet);
		const second = await createOwner(handle.db, wallet);

		expect(first.ok && second.ok && first.value.id === second.value.id).toBe(true);
		expect(second.ok && second.value.created).toBe(false);
	});

	it("refuses an address that is not a Solana address", async () => {
		const refused = await createOwner(handle.db, "not-an-address");
		expect(refused.ok).toBe(false);
	});

	it("refuses an id the record could never accept, even by a direct insert", async () => {
		const v4 = "1e2a5b6c-3d4e-4f5a-8b9c-0d1e2f3a4b5c";
		await expect(
			handle.sql`insert into owners (id, wallet_address) values (${v4}::uuid, ${address()})`,
		).rejects.toThrow();
	});

	it("still accepts a v7 id written directly, so nothing else has to change", async () => {
		const id = newId<"owner">();
		await handle.sql`insert into owners (id, wallet_address) values (${id}::uuid, ${address()})`;
		const [row] = await handle.sql<{ id: string }[]>`select id from owners where id = ${id}::uuid`;
		expect(row?.id).toBe(id);
	});
});
