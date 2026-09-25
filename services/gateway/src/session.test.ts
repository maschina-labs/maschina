/**
 * The glue: a real signature, a nonce that is spent once, and a session that follows.
 *
 * The database is faked here and proved for real in packages/integration-tests. What is real in these
 * tests is the keypair and the signature, because that is the part worth being sure about.
 */

import { signInMessage } from "@maschina/auth";
import { ManualClock, newId } from "@maschina/core";
import type { Database } from "@maschina/db";
import { testWallet } from "@maschina/solana/testing";
import { describe, expect, it, vi } from "vitest";
import { walletSessions } from "./session.ts";

const SETTINGS = {
	domain: "maschina.dev",
	uri: "https://maschina.dev",
	challengeValidForMs: 300_000,
	sessionValidForMs: 604_800_000,
};

const clock = () => new ManualClock("2026-09-25T12:00:00.000Z");

/** Answers each query in the order the code asks them. */
function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async (_query: unknown) => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

const ownerRow = (walletAddress: string) => [
	{ id: newId<"owner">(), wallet_address: walletAddress },
];

describe("asking a wallet to sign", () => {
	it("writes a sentence naming this domain and the nonce it hands out", async () => {
		const db = fakeDatabase();
		const sessions = walletSessions(db, clock(), SETTINGS);

		const challenge = await sessions.challenge("So11111111111111111111111111111111111111112");

		expect(challenge.message).toContain("maschina.dev wants you to sign in");
		expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`);
		expect(challenge.message).toContain("does not approve any transaction");
		expect(challenge.expiresAt).toBe("2026-09-25T12:05:00.000Z");
	});
});

describe("taking it back signed", () => {
	const signed = async (overrides: { domain?: string; nonce?: string } = {}) => {
		const wallet = await testWallet();
		const message = signInMessage({
			domain: overrides.domain ?? SETTINGS.domain,
			uri: SETTINGS.uri,
			address: wallet.address,
			nonce: overrides.nonce ?? "abc123",
			issuedAt: new Date("2026-09-25T12:00:00.000Z"),
			expiresAt: new Date("2026-09-25T12:05:00.000Z"),
		});
		return {
			wallet,
			request: { walletAddress: wallet.address, message, signature: await wallet.sign(message) },
		};
	};

	it("spends the nonce, finds the owner, and starts a session", async () => {
		const { request, wallet } = await signed();
		const db = fakeDatabase([{ nonce: "abc123" }], ownerRow(wallet.address), []);
		const sessions = walletSessions(db, clock(), SETTINGS);

		const started = await sessions.verify(request);

		expect(started.owner.walletAddress).toBe(wallet.address);
		expect(started.token).toHaveLength(43);
		expect(started.expiresAt).toEqual(new Date("2026-10-02T12:00:00.000Z"));
	});

	it("refuses when the nonce has already been spent", async () => {
		const { request } = await signed();
		const sessions = walletSessions(fakeDatabase([]), clock(), SETTINGS);

		await expect(sessions.verify(request)).rejects.toThrow("no longer valid");
	});

	it("refuses a message written for another site", async () => {
		const { request } = await signed({ domain: "evil.example" });
		const sessions = walletSessions(fakeDatabase([{ nonce: "abc123" }]), clock(), SETTINGS);

		await expect(sessions.verify(request)).rejects.toThrow("another site");
	});

	it("refuses when the message names a different wallet than the request", async () => {
		const { request } = await signed();
		const other = await testWallet();
		const sessions = walletSessions(fakeDatabase([{ nonce: "abc123" }]), clock(), SETTINGS);

		await expect(sessions.verify({ ...request, walletAddress: other.address })).rejects.toThrow(
			"different wallet",
		);
	});

	it("refuses something that is not a sign in message", async () => {
		const wallet = await testWallet();
		const message = "give me your money";
		const sessions = walletSessions(fakeDatabase(), clock(), SETTINGS);

		await expect(
			sessions.verify({
				walletAddress: wallet.address,
				message,
				signature: await wallet.sign(message),
			}),
		).rejects.toThrow("not a sign in message");
	});

	it("checks the signature before spending anything", async () => {
		const { request } = await signed();
		const other = await testWallet();
		const db = fakeDatabase([{ nonce: "abc123" }]);
		const sessions = walletSessions(db, clock(), SETTINGS);

		await expect(
			sessions.verify({ ...request, signature: await other.sign(request.message) }),
		).rejects.toThrow();
		// Nothing was spent, so the nonce is still there for the wallet that really owns it.
		expect(db.execute).not.toHaveBeenCalled();
	});
});

describe("carrying a session", () => {
	const headers = (cookie?: string) => new Headers(cookie ? { cookie } : {});

	it("finds the owner holding the cookie", async () => {
		const wallet = await testWallet();
		const ownerId = newId<"owner">();
		const db = fakeDatabase([
			{ id: newId<"session">(), owner_id: ownerId, wallet_address: wallet.address },
		]);
		const sessions = walletSessions(db, clock(), SETTINGS);

		expect(await sessions.ownerOf(headers("maschina_session=a-token"))).toEqual({
			ownerId,
			walletAddress: wallet.address,
		});
	});

	it("finds nobody without a cookie, and asks the database nothing", async () => {
		const db = fakeDatabase();
		const sessions = walletSessions(db, clock(), SETTINGS);

		expect(await sessions.ownerOf(headers())).toBeUndefined();
		expect(await sessions.ownerOf(headers("other=1; unrelated=2"))).toBeUndefined();
		expect(db.execute).not.toHaveBeenCalled();
	});

	it("reads its own cookie out of a header holding several", async () => {
		const db = fakeDatabase([]);
		const sessions = walletSessions(db, clock(), SETTINGS);

		await sessions.ownerOf(headers("theme=dark; maschina_session=a-token; other=1"));

		expect(db.execute).toHaveBeenCalledOnce();
	});

	it("ends a session on the way out", async () => {
		const db = fakeDatabase([]);
		await walletSessions(db, clock(), SETTINGS).signOut("a-token");

		expect(db.execute).toHaveBeenCalledOnce();
	});
});
