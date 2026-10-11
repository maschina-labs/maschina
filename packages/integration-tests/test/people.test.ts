/**
 * People who sign in without a wallet, against real Postgres.
 *
 * An owner used to be a wallet and nothing else. Now an owner can also be a person who signed in with an
 * email, Google, GitHub or their company, and who has no wallet yet. What the database has to hold is
 * that every owner is at least one of the two, that a wallet belongs to one owner, and that linking a
 * wallet later cannot take one from somebody else.
 */

import {
	createDatabase,
	createOwner,
	createOwnerForUser,
	type DatabaseHandle,
	linkWallet,
	ownerOfUser,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

const WALLET_A = "So11111111111111111111111111111111111111112";
const WALLET_B = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "people-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

/** What Better Auth writes when somebody signs up. */
async function aPerson(id: string, email: string) {
	await handle.sql`
		insert into auth_users (id, name, email, email_verified)
		values (${id}, 'A person', ${email}, true)`;
}

describe("an owner who signed in with a person's account", () => {
	it("is made with no wallet, and found again for the same person", async () => {
		await aPerson("person-1", "one@example.com");
		const made = await createOwnerForUser(handle.db, "person-1");
		expect(made.ok && made.value).toMatchObject({ walletAddress: null, created: true });
		const again = await createOwnerForUser(handle.db, "person-1");
		expect(again.ok && again.value).toMatchObject({ created: false });
		expect(again.ok && made.ok && again.value.id).toBe(made.ok && made.value.id);
	});

	it("is found by the person who owns it", async () => {
		await aPerson("person-2", "two@example.com");
		const made = await createOwnerForUser(handle.db, "person-2");
		const found = await ownerOfUser(handle.db, "person-2");
		expect(found).toMatchObject({ ownerId: made.ok ? made.value.id : "", walletAddress: null });
		expect(await ownerOfUser(handle.db, "nobody")).toBeUndefined();
	});

	it("makes ids the record accepts, which are v7", async () => {
		await aPerson("person-3", "three@example.com");
		const made = await createOwnerForUser(handle.db, "person-3");
		expect(made.ok && made.value.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
	});
});

describe("what the database refuses", () => {
	it("an owner that is neither a wallet nor a person", async () => {
		await expect(
			handle.sql`insert into owners (id) values (${"01900000-0000-7000-8000-000000000001"}::uuid)`,
		).rejects.toThrow();
	});

	it("two owners for one person", async () => {
		await aPerson("person-4", "four@example.com");
		await handle.sql`insert into owners (id, user_id) values (${"01900000-0000-7000-8000-000000000002"}::uuid, 'person-4')`;
		await expect(
			handle.sql`insert into owners (id, user_id) values (${"01900000-0000-7000-8000-000000000003"}::uuid, 'person-4')`,
		).rejects.toThrow();
	});
});

describe("linking a wallet to a person's owner", () => {
	it("gives the owner that wallet, and wallet sign in then finds the same owner", async () => {
		await aPerson("person-5", "five@example.com");
		const made = await createOwnerForUser(handle.db, "person-5");
		if (!made.ok) throw made.error;
		const linked = await linkWallet(handle.db, made.value.id, WALLET_A);
		expect(linked.ok).toBe(true);
		const byWallet = await createOwner(handle.db, WALLET_A);
		expect(byWallet.ok && byWallet.value).toMatchObject({ id: made.value.id, created: false });
	});

	it("refuses a wallet that already belongs to another owner", async () => {
		const taken = await createOwner(handle.db, WALLET_B);
		expect(taken.ok).toBe(true);
		await aPerson("person-6", "six@example.com");
		const made = await createOwnerForUser(handle.db, "person-6");
		if (!made.ok) throw made.error;
		const refused = await linkWallet(handle.db, made.value.id, WALLET_B);
		expect(refused.ok).toBe(false);
		expect(!refused.ok && refused.error.code).toBe("conflict");
	});

	it("refuses an address that is not one, and an owner that already has a different wallet", async () => {
		await aPerson("person-7", "seven@example.com");
		const made = await createOwnerForUser(handle.db, "person-7");
		if (!made.ok) throw made.error;
		expect((await linkWallet(handle.db, made.value.id, "nope")).ok).toBe(false);
		const first = await linkWallet(
			handle.db,
			made.value.id,
			"9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
		);
		expect(first.ok).toBe(true);
		const other = await linkWallet(
			handle.db,
			made.value.id,
			"DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
		);
		expect(other.ok).toBe(false);
	});

	it("is not an error to link the wallet the owner already has", async () => {
		await aPerson("person-8", "eight@example.com");
		const made = await createOwnerForUser(handle.db, "person-8");
		if (!made.ok) throw made.error;
		const w = "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH";
		expect((await linkWallet(handle.db, made.value.id, w)).ok).toBe(true);
		expect((await linkWallet(handle.db, made.value.id, w)).ok).toBe(true);
	});
});
