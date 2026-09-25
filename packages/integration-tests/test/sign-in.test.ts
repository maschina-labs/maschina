/**
 * Signing in, against real Postgres.
 *
 * The property that matters is that a nonce is spent exactly once, and it is a property of the database
 * rather than of the code, so it is proved here. Two requests racing with the same nonce means one
 * session and one refusal, every time.
 */

import {
	createDatabase,
	createOwner,
	type DatabaseHandle,
	endSession,
	forgetExpired,
	issueNonce,
	ownerOfSession,
	spendNonce,
	startSession,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

const WALLET = "So11111111111111111111111111111111111111112";
const now = () => new Date();

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "sign-in-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

describe("nonces", () => {
	it("can be spent once and never again", async () => {
		const { nonce } = await issueNonce(handle.db, WALLET, { now: now(), validForMs: 300_000 });

		const first = await spendNonce(handle.db, { nonce, walletAddress: WALLET, now: now() });
		const second = await spendNonce(handle.db, { nonce, walletAddress: WALLET, now: now() });

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(false);
	});

	it("is spent by exactly one of many attempts at the same moment", async () => {
		const { nonce } = await issueNonce(handle.db, WALLET, { now: now(), validForMs: 300_000 });

		const attempts = await Promise.all(
			Array.from({ length: 12 }, () =>
				spendNonce(handle.db, { nonce, walletAddress: WALLET, now: now() }),
			),
		);

		expect(attempts.filter((attempt) => attempt.ok)).toHaveLength(1);
	});

	it("cannot be answered by a different wallet", async () => {
		const { nonce } = await issueNonce(handle.db, WALLET, { now: now(), validForMs: 300_000 });
		const other = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

		const result = await spendNonce(handle.db, { nonce, walletAddress: other, now: now() });

		expect(result.ok).toBe(false);
	});

	it("stops working once it has expired", async () => {
		const { nonce } = await issueNonce(handle.db, WALLET, { now: now(), validForMs: -1 });

		expect((await spendNonce(handle.db, { nonce, walletAddress: WALLET, now: now() })).ok).toBe(
			false,
		);
	});
});

describe("sessions", () => {
	// Base58 has no zero, no capital O and no lowercase l, so the suffix is picked from what it does have.
	let made = 0;
	const wallet = () => {
		const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
		made += 1;
		const suffix = alphabet[made % alphabet.length] ?? "2";
		return `So111111111111111111111111111111111111111${suffix}`;
	};

	it("carries an owner from one request to the next, until it is ended", async () => {
		const owner = await createOwner(handle.db, wallet());
		expect(owner.ok).toBe(true);
		if (!owner.ok) return;

		const session = await startSession(handle.db, {
			ownerId: owner.value.id,
			now: now(),
			validForMs: 60_000,
		});

		expect(await ownerOfSession(handle.db, session.token, now())).toMatchObject({
			ownerId: owner.value.id,
		});

		await endSession(handle.db, session.token, now());
		expect(await ownerOfSession(handle.db, session.token, now())).toBeUndefined();
	});

	it("carries nobody once it has expired", async () => {
		const owner = await createOwner(handle.db, wallet());
		if (!owner.ok) return;
		const session = await startSession(handle.db, {
			ownerId: owner.value.id,
			now: new Date(Date.now() - 120_000),
			validForMs: 60_000,
		});

		expect(await ownerOfSession(handle.db, session.token, now())).toBeUndefined();
	});

	it("carries nobody for a token nobody was given", async () => {
		expect(await ownerOfSession(handle.db, "not a real token", now())).toBeUndefined();
	});

	it("forgets what expired, and leaves what has not", async () => {
		const owner = await createOwner(handle.db, wallet());
		if (!owner.ok) return;
		const live = await startSession(handle.db, {
			ownerId: owner.value.id,
			now: now(),
			validForMs: 600_000,
		});

		await forgetExpired(handle.db, now());

		expect(await ownerOfSession(handle.db, live.token, now())).toMatchObject({
			ownerId: owner.value.id,
		});
	});
});
