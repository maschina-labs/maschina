/**
 * Owner secrets, against real Postgres: one of each kind per owner, replaced not stacked, and nothing
 * stored that is not sealed.
 */

import {
	clearOwnerSecret,
	createDatabase,
	createOwner,
	type DatabaseHandle,
	readOwnerSecret,
	setOwnerSecret,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "owner-secrets-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

async function anOwner() {
	const made = await createOwner(handle.db, address());
	if (!made.ok) throw made.error;
	return made.value.id;
}

describe("an owner's secrets", () => {
	it("keeps one, and gives it back", async () => {
		const owner = await anOwner();
		await setOwnerSecret(handle.db, {
			ownerId: owner,
			kind: "anthropic",
			sealed: "v1.a.b.c",
			hint: "wxyz",
		});
		expect(await readOwnerSecret(handle.db, owner, "anthropic")).toMatchObject({
			sealed: "v1.a.b.c",
			hint: "wxyz",
		});
	});

	it("replaces the old one when a new one is given", async () => {
		const owner = await anOwner();
		await setOwnerSecret(handle.db, {
			ownerId: owner,
			kind: "anthropic",
			sealed: "v1.old",
			hint: "0000",
		});
		await setOwnerSecret(handle.db, {
			ownerId: owner,
			kind: "anthropic",
			sealed: "v1.new",
			hint: "1111",
		});
		expect((await readOwnerSecret(handle.db, owner, "anthropic"))?.hint).toBe("1111");
	});

	it("forgets it when asked, and says nothing is there", async () => {
		const owner = await anOwner();
		await setOwnerSecret(handle.db, {
			ownerId: owner,
			kind: "anthropic",
			sealed: "v1.x",
			hint: "2222",
		});
		expect(await clearOwnerSecret(handle.db, owner, "anthropic")).toBe(true);
		expect(await readOwnerSecret(handle.db, owner, "anthropic")).toBeUndefined();
		expect(await clearOwnerSecret(handle.db, owner, "anthropic")).toBe(false);
	});

	it("keeps owners apart", async () => {
		const one = await anOwner();
		const two = await anOwner();
		await setOwnerSecret(handle.db, {
			ownerId: one,
			kind: "anthropic",
			sealed: "v1.one",
			hint: "3333",
		});
		expect(await readOwnerSecret(handle.db, two, "anthropic")).toBeUndefined();
	});

	it("refuses anything that is not sealed, even written directly", async () => {
		const owner = await anOwner();
		await expect(
			setOwnerSecret(handle.db, {
				ownerId: owner,
				kind: "anthropic",
				sealed: "sk-ant-plain",
				hint: "x",
			}),
		).rejects.toThrow();
	});
});
