/**
 * Signing in, as the database sees it.
 *
 * Two things are remembered and both are deliberately small. A nonce, handed out before a wallet signs
 * anything, which may be answered exactly once. And a session, which is a long random token the browser
 * holds and whose hash is all that is stored here.
 *
 * Single use is a conditional update rather than a read followed by a write, because a read followed by
 * a write has a gap in the middle, and the whole value of a nonce is that two people cannot both spend
 * it. The same reasoning appears everywhere in this codebase: the database decides, not the code.
 */

import { createHash, randomBytes } from "node:crypto";
import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

/** Long enough that guessing is hopeless, short enough to read in a wallet. */
const NONCE_BYTES = 16;
const TOKEN_BYTES = 32;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type IssuedNonce = { nonce: string; expiresAt: Date };

/** Hands out a nonce for one wallet to answer, good until it expires or is spent. */
export async function issueNonce(
	db: Executor,
	walletAddress: string,
	options: { now: Date; validForMs: number },
): Promise<IssuedNonce> {
	const nonce = randomBytes(NONCE_BYTES).toString("hex");
	const expiresAt = new Date(options.now.getTime() + options.validForMs);
	await db.execute(sql`
		insert into sign_in_nonces (nonce, wallet_address, issued_at, expires_at)
		values (${nonce}, ${walletAddress}, ${options.now.toISOString()}::timestamptz,
			${expiresAt.toISOString()}::timestamptz)`);
	return { nonce, expiresAt };
}

/**
 * Spends a nonce, or refuses.
 *
 * The update only touches a row that is unspent, unexpired and belongs to this wallet, and it reports
 * whether it touched one. Two requests racing with the same nonce means exactly one of them updates a
 * row, so exactly one of them signs in.
 */
export async function spendNonce(
	db: Executor,
	request: { nonce: string; walletAddress: string; now: Date },
): Promise<Result<true, MaschinaError>> {
	const rows = await db.execute<{ nonce: string }>(sql`
		update sign_in_nonces set used_at = ${request.now.toISOString()}::timestamptz
		where nonce = ${request.nonce}
			and wallet_address = ${request.walletAddress}
			and used_at is null
			and expires_at > ${request.now.toISOString()}::timestamptz
		returning nonce`);

	if (!rows[0]) {
		// Spent, expired, never issued, or issued to somebody else: all the same answer from outside.
		return err(new MaschinaError("unauthenticated", "that sign in attempt is no longer valid"));
	}
	return ok(true);
}

export type StartedSession = { id: string; token: string; expiresAt: Date };

/** Starts a session and hands back the only copy of its token. */
export async function startSession(
	db: Executor,
	request: { ownerId: string; now: Date; validForMs: number },
): Promise<StartedSession> {
	const id = newId<"session">();
	const token = randomBytes(TOKEN_BYTES).toString("base64url");
	const expiresAt = new Date(request.now.getTime() + request.validForMs);
	await db.execute(sql`
		insert into sessions (id, owner_id, token_hash, created_at, expires_at)
		values (${id}::uuid, ${request.ownerId}::uuid, ${hashToken(token)},
			${request.now.toISOString()}::timestamptz, ${expiresAt.toISOString()}::timestamptz)`);
	return { id, token, expiresAt };
}

export type SessionOwner = { sessionId: string; ownerId: string; walletAddress: string };

/** Who is holding this token, if anybody still is. */
export async function ownerOfSession(
	db: Executor,
	token: string,
	now: Date,
): Promise<SessionOwner | undefined> {
	const rows = await db.execute<{ id: string; owner_id: string; wallet_address: string }>(sql`
		select sessions.id, sessions.owner_id, owners.wallet_address
		from sessions
		join owners on owners.id = sessions.owner_id
		where sessions.token_hash = ${hashToken(token)}
			and sessions.ended_at is null
			and sessions.expires_at > ${now.toISOString()}::timestamptz`);

	const row = rows[0];
	if (!row) return undefined;
	return { sessionId: row.id, ownerId: row.owner_id, walletAddress: row.wallet_address };
}

/** Ends a session. Ending one that is already ended, or never existed, is not an error. */
export async function endSession(db: Executor, token: string, now: Date): Promise<void> {
	await db.execute(sql`
		update sessions set ended_at = ${now.toISOString()}::timestamptz
		where token_hash = ${hashToken(token)} and ended_at is null`);
}

/** Housekeeping: nonces and sessions that can never be used again are not worth keeping. */
export async function forgetExpired(db: Executor, now: Date): Promise<void> {
	const moment = now.toISOString();
	await db.execute(sql`delete from sign_in_nonces where expires_at < ${moment}::timestamptz`);
	await db.execute(sql`delete from sessions where expires_at < ${moment}::timestamptz`);
}
