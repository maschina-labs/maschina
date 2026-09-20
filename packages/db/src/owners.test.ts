import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { createOwner } from "./owners.ts";

// Against a real database this is proved in packages/integration-tests.

const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

describe("createOwner", () => {
	it("refuses anything that is not a Solana address, before asking the database", async () => {
		const db = fakeDatabase();
		const refused = await createOwner(db, "nope");
		expect(refused.ok).toBe(false);
	});

	it("reports an owner it just made as created", async () => {
		const db = fakeDatabase([{ id: "01a0-made", wallet_address: WALLET }]);
		const made = await createOwner(db, WALLET);
		expect(made.ok && made.value).toMatchObject({ walletAddress: WALLET, created: true });
	});

	it("gives back the owner that already exists for that wallet", async () => {
		const db = fakeDatabase([], [{ id: "01a0-existing", wallet_address: WALLET }]);
		const found = await createOwner(db, WALLET);
		expect(found.ok && found.value).toMatchObject({ id: "01a0-existing", created: false });
	});

	it("says so when the owner is neither made nor found, rather than pretending", async () => {
		const db = fakeDatabase([], []);
		const neither = await createOwner(db, WALLET);
		expect(neither.ok).toBe(false);
	});
});
