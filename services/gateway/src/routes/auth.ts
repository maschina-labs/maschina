/**
 * Signing in with a wallet.
 *
 * Two requests. The first asks for a sentence to sign, and the server remembers the nonce inside it.
 * The second returns that sentence signed, and if everything about it holds, the server starts a
 * session and puts its token in a cookie the browser cannot read from script.
 *
 * The cookie is the only thing that carries a session. Nothing here accepts a token in a header or a
 * query string, because a token in a URL ends up in logs, in referrers and in somebody's history.
 */

import { randomBytes } from "node:crypto";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	ErrorBody,
	SignedInOwner,
	SignInChallenge,
	SignInChallengeRequest,
	SignInRequest,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Owner } from "./machines.ts";

export const SESSION_COOKIE = "maschina_session";

/** Holds the secret a browser asked for its sign in message with, so only that browser can finish signing in. */
export const BINDING_COOKIE = "maschina_siws";

/** A sign in that is not finished by then was abandoned, and a new one is asked for. */
const BINDING_VALID_SECONDS = 10 * 60;

export type StartedSession = { token: string; expiresAt: Date; owner: Owner };

export type AuthPorts = {
	/** The sentence this wallet should sign, and the nonce it answers. `binding` is the secret the asking browser holds. */
	challenge(walletAddress: string, binding: string): Promise<SignInChallenge>;
	/** Checks a signed sentence, spends its nonce, and starts a session. */
	verify(request: SignInRequest, binding: string): Promise<StartedSession>;
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	signOut(token: string): Promise<void>;
	/** Checks a signed sentence the same way, spends its nonce, and gives the owner that wallet. Starts no session. */
	linkWallet(request: SignInRequest, owner: Owner, binding: string): Promise<Owner>;
};

export type CookieSettings = {
	/** Left out in development, where there is no shared parent domain and no https. */
	domain?: string | undefined;
	secure: boolean;
};

const problem = {
	400: {
		description: "The request is not shaped correctly",
		content: { "application/json": { schema: ErrorBody } },
	},
	401: {
		description: "Not signed in, or the signature does not hold",
		content: { "application/json": { schema: ErrorBody } },
	},
} as const;

const challenge = createRoute({
	method: "post",
	path: "/auth/challenge",
	tags: ["Sign in"],
	summary: "Ask for a sentence to sign",
	request: {
		body: { content: { "application/json": { schema: SignInChallengeRequest } }, required: true },
	},
	responses: {
		200: {
			description: "The exact sentence to sign",
			content: { "application/json": { schema: SignInChallenge } },
		},
		...problem,
	},
});

const verify = createRoute({
	method: "post",
	path: "/auth/verify",
	tags: ["Sign in"],
	summary: "Return the signed sentence and start a session",
	request: {
		body: { content: { "application/json": { schema: SignInRequest } }, required: true },
	},
	responses: {
		200: {
			description: "Signed in, and the session is in a cookie",
			content: { "application/json": { schema: SignedInOwner } },
		},
		...problem,
	},
});

const linkWallet = createRoute({
	method: "post",
	path: "/auth/link-wallet",
	tags: ["Sign in"],
	summary: "Add a wallet to the owner who is signed in",
	request: {
		body: { content: { "application/json": { schema: SignInRequest } }, required: true },
	},
	responses: {
		200: {
			description: "The owner, now with that wallet",
			content: { "application/json": { schema: SignedInOwner } },
		},
		...problem,
		409: {
			description: "That wallet belongs to another owner, or this owner has a different one",
			content: { "application/json": { schema: ErrorBody } },
		},
	},
});

const me = createRoute({
	method: "get",
	path: "/auth/me",
	tags: ["Sign in"],
	summary: "Who this session belongs to",
	responses: {
		200: {
			description: "The signed in owner",
			content: { "application/json": { schema: SignedInOwner } },
		},
		...problem,
	},
});

const signOut = createRoute({
	method: "post",
	path: "/auth/sign-out",
	tags: ["Sign in"],
	summary: "End this session",
	responses: {
		204: { description: "Ended, whether or not there was one" },
	},
});

export function authRoutes(ports: AuthPorts, cookie: CookieSettings) {
	const attributes = {
		httpOnly: true,
		secure: cookie.secure,
		// Lax is enough: the app and the API share a parent domain, and nothing here is a cross site form.
		sameSite: "Lax",
		path: "/",
		...(cookie.domain === undefined ? {} : { domain: cookie.domain }),
	} as const;

	// Host only and scoped to the sign in routes: nothing else is sent it, and no other subdomain can read it.
	const bindingAttributes = {
		httpOnly: true,
		secure: cookie.secure,
		sameSite: "Lax",
		path: "/v1/auth",
	} as const;

	const bindingOf = (c: Parameters<typeof getCookie>[0]): string => {
		const held = getCookie(c, BINDING_COOKIE);
		if (!held) {
			throw new MaschinaError(
				"unauthenticated",
				"this sign in was not started in this browser, so ask for a new one",
			);
		}
		return held;
	};

	return new OpenAPIHono<ServiceEnv>()
		.openapi(challenge, async (c) => {
			const { walletAddress } = c.req.valid("json");
			// A secret only this browser holds. The message names its hash, so a signature somebody collected for their
			// own browser cannot be pushed into this one, and this one's cannot be collected by anybody else.
			const binding = randomBytes(32).toString("base64url");
			setCookie(c, BINDING_COOKIE, binding, {
				...bindingAttributes,
				maxAge: BINDING_VALID_SECONDS,
			});
			return c.json(await ports.challenge(walletAddress, binding), 200);
		})
		.openapi(verify, async (c) => {
			const binding = bindingOf(c);
			const started = await ports.verify(c.req.valid("json"), binding);
			deleteCookie(c, BINDING_COOKIE, bindingAttributes);
			setCookie(c, SESSION_COOKIE, started.token, {
				...attributes,
				expires: started.expiresAt,
			});
			return c.json(
				{
					ownerId: started.owner.ownerId,
					walletAddress: started.owner.walletAddress,
					email: started.owner.email ?? null,
				},
				200,
			);
		})
		.openapi(linkWallet, async (c) => {
			const who = await ports.ownerOf(c.req.raw.headers);
			if (!who) throw new MaschinaError("unauthenticated", "sign in first");
			// The wallet has to sign a sentence this server wrote, the same as signing in: owning an address is
			// shown by signing with it, never by saying so.
			const linked = await ports.linkWallet(c.req.valid("json"), who, bindingOf(c));
			deleteCookie(c, BINDING_COOKIE, bindingAttributes);
			return c.json(
				{
					ownerId: linked.ownerId,
					walletAddress: linked.walletAddress,
					email: linked.email ?? null,
				},
				200,
			);
		})
		.openapi(me, async (c) => {
			const owner = await ports.ownerOf(c.req.raw.headers);
			if (!owner) throw new MaschinaError("unauthenticated", "sign in first");
			return c.json(
				{
					ownerId: owner.ownerId,
					walletAddress: owner.walletAddress,
					email: owner.email ?? null,
				},
				200,
			);
		})
		.openapi(signOut, async (c) => {
			const token = getCookie(c, SESSION_COOKIE);
			if (token) await ports.signOut(token);
			deleteCookie(c, SESSION_COOKIE, attributes);
			return c.body(null, 204);
		});
}
