/**
 * Who is asking.
 *
 * A session starts when a wallet signs a sentence this server wrote, naming this domain and a nonce
 * this server handed out moments earlier. Everything that can be decided from the message alone is
 * decided in `@maschina/solana`. Everything that needs memory happens here: the nonce is spent exactly
 * once, the owner is found or made, and a session token is issued.
 *
 * The token reaches the browser in a cookie and is never stored as itself. A request carrying a token
 * nobody was given, or one that has expired or been ended, is simply nobody.
 */

import { signInMessage, verifySignIn } from "@maschina/auth";
import type { SignInChallenge, SignInRequest } from "@maschina/contracts";
import { type Clock, MaschinaError } from "@maschina/core";
import type { Database } from "@maschina/db";
import {
	createOwner,
	endSession,
	issueNonce,
	ownerOfSession,
	spendNonce,
	startSession,
} from "@maschina/db";
import { getCookie } from "hono/cookie";
import type { StartedSession } from "./routes/auth.ts";
import { SESSION_COOKIE } from "./routes/auth.ts";
import type { Owner } from "./routes/machines.ts";

export type SessionSettings = {
	/** The domain the message names, which is the domain a signature is only good for. */
	domain: string;
	/** Where the app lives, shown in the message so a person can see what they are signing into. */
	uri: string;
	challengeValidForMs: number;
	sessionValidForMs: number;
};

export type Sessions = {
	challenge(walletAddress: string): Promise<SignInChallenge>;
	verify(request: SignInRequest): Promise<StartedSession>;
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	signOut(token: string): Promise<void>;
};

export function walletSessions(db: Database, clock: Clock, settings: SessionSettings): Sessions {
	return {
		async challenge(walletAddress) {
			const now = clock.now();
			const { nonce, expiresAt } = await issueNonce(db, walletAddress, {
				now,
				validForMs: settings.challengeValidForMs,
			});
			return {
				message: signInMessage({
					domain: settings.domain,
					uri: settings.uri,
					address: walletAddress,
					nonce,
					issuedAt: now,
					expiresAt,
				}),
				nonce,
				expiresAt: expiresAt.toISOString(),
			};
		},

		async verify(request) {
			const now = clock.now();
			// The nonce comes out of the message, so a message claiming a different one cannot pass.
			const nonce = request.message.match(/^Nonce: (.+)$/m)?.[1];
			if (!nonce) throw new MaschinaError("unauthenticated", "that is not a sign in message");

			const checked = await verifySignIn({
				message: request.message,
				signature: request.signature,
				domain: settings.domain,
				nonce,
				now,
			});
			if (!checked.ok) throw checked.error;
			if (checked.value.address !== request.walletAddress) {
				throw new MaschinaError("unauthenticated", "that message names a different wallet");
			}

			// Spending the nonce is what makes this unrepeatable, and it happens before a session exists.
			const spent = await spendNonce(db, {
				nonce,
				walletAddress: request.walletAddress,
				now,
			});
			if (!spent.ok) throw spent.error;

			const owner = await createOwner(db, request.walletAddress);
			if (!owner.ok) throw owner.error;

			const session = await startSession(db, {
				ownerId: owner.value.id,
				now,
				validForMs: settings.sessionValidForMs,
			});
			return {
				token: session.token,
				expiresAt: session.expiresAt,
				owner: { ownerId: owner.value.id, walletAddress: owner.value.walletAddress },
			};
		},

		async ownerOf(headers) {
			const token = cookieFrom(headers, SESSION_COOKIE);
			if (!token) return undefined;
			const found = await ownerOfSession(db, token, clock.now());
			return found ? { ownerId: found.ownerId, walletAddress: found.walletAddress } : undefined;
		},

		async signOut(token) {
			await endSession(db, token, clock.now());
		},
	};
}

/** Hono's helper wants a context; a header is all that is available here. */
function cookieFrom(headers: Headers, name: string): string | undefined {
	const header = headers.get("cookie");
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return decodeURIComponent(rest.join("="));
	}
	return undefined;
}

export { getCookie };
