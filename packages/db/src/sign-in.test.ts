import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import {
	endSession,
	forgetExpired,
	hashToken,
	issueNonce,
	ownerOfSession,
	spendNonce,
	startSession,
} from "./sign-in.ts";

// Against a real database this is proved in packages/integration-tests.

const WALLET = "So11111111111111111111111111111111111111112";
const NOW = new Date("2026-09-25T12:00:00.000Z");

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async (_query: unknown) => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

const chunksOf = (db: Database): unknown[] => {
	const [query] = vi.mocked(db.execute).mock.calls.at(-1) ?? [];
	return (query as unknown as { queryChunks: unknown[] }).queryChunks;
};

/** The SQL itself, without the values drizzle pulled out of it. */
const lastStatement = (db: Database): string =>
	chunksOf(db)
		.map((chunk) => {
			const text = (chunk as { value?: unknown }).value;
			return Array.isArray(text) ? text.join("") : "";
		})
		.join(" ");

/** The values, which are the part that must never contain a secret. */
const lastValues = (db: Database): string[] =>
	chunksOf(db).filter((chunk): chunk is string => typeof chunk === "string");

describe("nonces", () => {
	it("hands out a different nonce every time, good until it expires", async () => {
		const db = fakeDatabase();
		const first = await issueNonce(db, WALLET, { now: NOW, validForMs: 300_000 });
		const second = await issueNonce(db, WALLET, { now: NOW, validForMs: 300_000 });

		expect(first.nonce).not.toBe(second.nonce);
		expect(first.nonce).toMatch(/^[0-9a-f]{32}$/);
		expect(first.expiresAt).toEqual(new Date("2026-09-25T12:05:00.000Z"));
	});

	it("is spent by the update itself, so two answers cannot both succeed", async () => {
		const db = fakeDatabase([{ nonce: "abc" }]);

		expect(await spendNonce(db, { nonce: "abc", walletAddress: WALLET, now: NOW })).toEqual({
			ok: true,
			value: true,
		});
		expect(lastStatement(db)).toContain("update sign_in_nonces");
		expect(lastStatement(db)).toContain("used_at is null");
	});

	it("refuses a nonce that was already spent, expired, or never handed out", async () => {
		const db = fakeDatabase([]);
		const result = await spendNonce(db, { nonce: "abc", walletAddress: WALLET, now: NOW });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("unauthenticated");
	});
});

describe("sessions", () => {
	const ownerId = newId<"owner">();

	it("hands back a token and stores only its hash", async () => {
		const db = fakeDatabase();
		const session = await startSession(db, { ownerId, now: NOW, validForMs: 604_800_000 });

		expect(session.token).toHaveLength(43);
		expect(session.expiresAt).toEqual(new Date("2026-10-02T12:00:00.000Z"));
		expect(lastStatement(db)).toContain("token_hash");
		// The token reaches the browser and nowhere else: only its hash is ever written down.
		expect(lastValues(db)).not.toContain(session.token);
	});

	it("finds who is holding a token", async () => {
		const sessionId = newId<"session">();
		const db = fakeDatabase([{ id: sessionId, owner_id: ownerId, wallet_address: WALLET }]);

		expect(await ownerOfSession(db, "a token", NOW)).toEqual({
			sessionId,
			ownerId,
			walletAddress: WALLET,
		});
	});

	it("finds nobody for a token that is ended, expired or invented", async () => {
		expect(await ownerOfSession(fakeDatabase([]), "a token", NOW)).toBeUndefined();
	});

	it("looks a token up by its hash, never by the token", async () => {
		const db = fakeDatabase([]);
		await ownerOfSession(db, "a token", NOW);

		expect(lastValues(db)).not.toContain("a token");
	});

	it("ends a session, and ending one twice is not an error", async () => {
		const db = fakeDatabase([], []);
		await endSession(db, "a token", NOW);
		await endSession(db, "a token", NOW);

		expect(lastStatement(db)).toContain("ended_at is null");
	});

	it("forgets what can never be used again", async () => {
		const db = fakeDatabase([], []);
		await forgetExpired(db, NOW);

		expect(vi.mocked(db.execute)).toHaveBeenCalledTimes(2);
	});
});

describe("hashing", () => {
	it("gives the same hash for the same token, and a different one otherwise", () => {
		expect(hashToken("one")).toBe(hashToken("one"));
		expect(hashToken("one")).not.toBe(hashToken("two"));
		expect(hashToken("one")).toMatch(/^[0-9a-f]{64}$/);
	});
});
