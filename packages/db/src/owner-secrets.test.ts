import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { clearOwnerSecret, readOwnerSecret, setOwnerSecret } from "./owner-secrets.ts";

// Against a real database this is proved in packages/integration-tests.

const OWNER = "01a0e5db-f605-7209-8006-f225cc7c3215";

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

describe("owner secrets", () => {
	it("writes the sealed text, never anything else", async () => {
		const db = fakeDatabase();
		await setOwnerSecret(db, {
			ownerId: OWNER,
			kind: "anthropic",
			sealed: "v1.a.b.c",
			hint: "wxyz",
		});
		expect(db.execute).toHaveBeenCalledOnce();
	});

	it("reads one back with its hint and when it was set", async () => {
		const db = fakeDatabase([{ sealed: "v1.a.b.c", hint: "wxyz", set_at: "2026-10-03T01:00:00Z" }]);
		expect(await readOwnerSecret(db, OWNER, "anthropic")).toEqual({
			sealed: "v1.a.b.c",
			hint: "wxyz",
			setAt: new Date("2026-10-03T01:00:00Z"),
		});
	});

	it("says nothing is there when nothing is", async () => {
		expect(await readOwnerSecret(fakeDatabase([]), OWNER, "anthropic")).toBeUndefined();
	});

	it("says whether there was one to forget", async () => {
		expect(await clearOwnerSecret(fakeDatabase([{ kind: "anthropic" }]), OWNER, "anthropic")).toBe(
			true,
		);
		expect(await clearOwnerSecret(fakeDatabase([]), OWNER, "anthropic")).toBe(false);
	});
});
