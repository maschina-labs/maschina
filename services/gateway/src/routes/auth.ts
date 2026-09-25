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

export type StartedSession = { token: string; expiresAt: Date; owner: Owner };

export type AuthPorts = {
	/** The sentence this wallet should sign, and the nonce it answers. */
	challenge(walletAddress: string): Promise<SignInChallenge>;
	/** Checks a signed sentence, spends its nonce, and starts a session. */
	verify(request: SignInRequest): Promise<StartedSession>;
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	signOut(token: string): Promise<void>;
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

	return new OpenAPIHono<ServiceEnv>()
		.openapi(challenge, async (c) => {
			const { walletAddress } = c.req.valid("json");
			return c.json(await ports.challenge(walletAddress), 200);
		})
		.openapi(verify, async (c) => {
			const started = await ports.verify(c.req.valid("json"));
			setCookie(c, SESSION_COOKIE, started.token, {
				...attributes,
				expires: started.expiresAt,
			});
			return c.json(
				{ ownerId: started.owner.ownerId, walletAddress: started.owner.walletAddress },
				200,
			);
		})
		.openapi(me, async (c) => {
			const owner = await ports.ownerOf(c.req.raw.headers);
			if (!owner) throw new MaschinaError("unauthenticated", "sign in first");
			return c.json({ ownerId: owner.ownerId, walletAddress: owner.walletAddress }, 200);
		})
		.openapi(signOut, async (c) => {
			const token = getCookie(c, SESSION_COOKIE);
			if (token) await ports.signOut(token);
			deleteCookie(c, SESSION_COOKIE, attributes);
			return c.body(null, 204);
		});
}
