import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { createOwnerForUser, linkWallet, ownerOfUser } from "./people.ts";

// Against a real database this is proved in packages/integration-tests.

const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const OWNER = "01900000-0000-7000-8000-000000000001";

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

describe("createOwnerForUser", () => {
	it("reports an owner it just made, with no wallet", async () => {
		const made = await createOwnerForUser(fakeDatabase([{ id: OWNER }]), "person");
		expect(made.ok && made.value).toMatchObject({ id: OWNER, walletAddress: null, created: true });
	});

	it("gives back the owner the person already has, wallet and all", async () => {
		const found = await createOwnerForUser(
			fakeDatabase([], [{ id: OWNER, wallet_address: WALLET }]),
			"person",
		);
		expect(found.ok && found.value).toMatchObject({ walletAddress: WALLET, created: false });
	});

	it("says so when the owner is neither made nor found", async () => {
		expect((await createOwnerForUser(fakeDatabase([], []), "person")).ok).toBe(false);
	});
});

describe("ownerOfUser", () => {
	it("finds the owner, and says nothing when there is none", async () => {
		expect(await ownerOfUser(fakeDatabase([{ id: OWNER, wallet_address: null }]), "p")).toEqual({
			ownerId: OWNER,
			walletAddress: null,
		});
		expect(await ownerOfUser(fakeDatabase([]), "p")).toBeUndefined();
	});
});

describe("linkWallet", () => {
	it("refuses anything that is not a Solana address, before asking the database", async () => {
		const refused = await linkWallet(fakeDatabase(), OWNER, "nope");
		expect(!refused.ok && refused.error.code).toBe("invalid_input");
	});

	it("says so when there is no such owner", async () => {
		const none = await linkWallet(fakeDatabase([]), OWNER, WALLET);
		expect(!none.ok && none.error.code).toBe("not_found");
	});

	it("accepts the wallet the owner already has", async () => {
		expect((await linkWallet(fakeDatabase([{ wallet_address: WALLET }]), OWNER, WALLET)).ok).toBe(
			true,
		);
	});

	it("keeps a different wallet the owner already has", async () => {
		const other = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
		const kept = await linkWallet(fakeDatabase([{ wallet_address: other }]), OWNER, WALLET);
		expect(!kept.ok && kept.error.code).toBe("conflict");
	});

	it("links a wallet when the owner has none and nobody else has it", async () => {
		const linked = await linkWallet(
			fakeDatabase([{ wallet_address: null }], [{ id: OWNER }]),
			OWNER,
			WALLET,
		);
		expect(linked.ok && linked.value.walletAddress).toBe(WALLET);
	});

	it("refuses a wallet another owner has", async () => {
		const taken = await linkWallet(fakeDatabase([{ wallet_address: null }], []), OWNER, WALLET);
		expect(!taken.ok && taken.error.code).toBe("conflict");
	});
});
