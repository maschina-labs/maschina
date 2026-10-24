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

import { createHash } from "node:crypto";
import { signInMessage, verifySignIn } from "@maschina/auth";
import type { SignInChallenge, SignInRequest } from "@maschina/contracts";
import { type Clock, MaschinaError } from "@maschina/core";
import type { Database } from "@maschina/db";
import {
	createOwner,
	endSession,
	issueNonce,
	linkWallet,
	ownerOfSession,
	spendNonce,
	startSession,
} from "@maschina/db";
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

/**
 * What a sign in message says about the browser that asked for it: a hash of a secret only that browser holds, in a
 * cookie it cannot read from script. The message is signed, so the signature is good for that browser alone.
 */
export function requestIdOf(binding: string): string {
	return createHash("sha256").update(binding).digest("hex").slice(0, 32);
}

export type Sessions = {
	/** `binding` is the secret the asking browser holds, which the message will name by its hash. */
	challenge(walletAddress: string, binding: string): Promise<SignInChallenge>;
	verify(request: SignInRequest, binding: string): Promise<StartedSession>;
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	signOut(token: string): Promise<void>;
	linkWallet(request: SignInRequest, owner: Owner, binding: string): Promise<Owner>;
};

/** Whoever is asked first who knows the request: a wallet's session, then a person's. */
export function firstOwner(
	...finders: (((headers: Headers) => Promise<Owner | undefined>) | undefined)[]
): (headers: Headers) => Promise<Owner | undefined> {
	return async (headers) => {
		for (const find of finders) {
			const found = await find?.(headers);
			if (found) return found;
		}
		return undefined;
	};
}

export function walletSessions(db: Database, clock: Clock, settings: SessionSettings): Sessions {
	/**
	 * The proof that a wallet is this wallet: the nonce comes out of the message, so a message claiming a different
	 * one cannot pass, the signature is checked before anything is spent, and spending the nonce is what makes it
	 * unrepeatable.
	 */
	async function proveWallet(request: SignInRequest, now: Date, binding: string): Promise<void> {
		const nonce = request.message.match(/^Nonce: (.+)$/m)?.[1];
		if (!nonce) throw new MaschinaError("unauthenticated", "that is not a sign in message");

		const checked = await verifySignIn({
			message: request.message,
			signature: request.signature,
			domain: settings.domain,
			uri: settings.uri,
			requestId: requestIdOf(binding),
			nonce,
			now,
		});
		if (!checked.ok) throw checked.error;
		if (checked.value.address !== request.walletAddress) {
			throw new MaschinaError("unauthenticated", "that message names a different wallet");
		}

		const spent = await spendNonce(db, { nonce, walletAddress: request.walletAddress, now });
		if (!spent.ok) throw spent.error;
	}

	return {
		async challenge(walletAddress, binding) {
			const now = clock.now();
			const { nonce, expiresAt } = await issueNonce(db, walletAddress, {
				now,
				validForMs: settings.challengeValidForMs,
			});
			return {
				message: signInMessage({
					domain: settings.domain,
					uri: settings.uri,
					requestId: requestIdOf(binding),
					address: walletAddress,
					nonce,
					issuedAt: now,
					expiresAt,
				}),
				nonce,
				expiresAt: expiresAt.toISOString(),
			};
		},

		async verify(request, binding) {
			const now = clock.now();
			await proveWallet(request, now, binding);

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

		async linkWallet(request, owner, binding) {
			// The same proof as signing in: a sentence this server wrote, signed by that wallet, once.
			await proveWallet(request, clock.now(), binding);
			const linked = await linkWallet(db, owner.ownerId, request.walletAddress);
			if (!linked.ok) throw linked.error;
			return { ...owner, walletAddress: linked.value.walletAddress };
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
