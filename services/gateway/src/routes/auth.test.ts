/**
 * Signing in, through the API, with a real keypair.
 *
 * The session travels in a cookie the browser cannot read from script, so these tests check the cookie
 * as carefully as the body: what it holds, what it is scoped to, and that it is gone after signing out.
 */

import { ManualClock, newId } from "@maschina/core";
import { testWallet } from "@maschina/solana/testing";
import { createLogger } from "@maschina/telemetry";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { AuthPorts, StartedSession } from "./auth.ts";
import type { Owner } from "./machines.ts";

const logger = createLogger({ service: "t", level: "silent" });
const clock = new ManualClock("2026-09-25T12:00:00.000Z");

const noMachines = {
	ownerOf: async () => undefined,
	list: async () => [],
	read: async () => undefined,
	record: async () => [],
	act: async () => ({ state: "ready" }),
	retune: async () => ({ definitionId: "e".repeat(64) }),
	funding: async () => {
		throw new Error("not used here");
	},
	balances: async () => {
		throw new Error("not used here");
	},
	withdrawEverything: async () => {
		throw new Error("not used here");
	},
	create: async () => {
		throw new Error("not used here");
	},
};

/** A wallet that can actually sign, because a fake signature proves nothing about this code. */
const wallet = testWallet;

function fakeAuth() {
	let signedIn: Owner | undefined;
	const ended: string[] = [];
	const challenged: string[] = [];
	const verifiedWith: string[] = [];
	const ports: AuthPorts = {
		challenge: async (walletAddress, binding) => {
			challenged.push(binding);
			return {
				message: `localhost wants you to sign in with your Solana account:\n${walletAddress}`,
				nonce: "abc123",
				expiresAt: "2026-09-25T12:05:00.000Z",
			};
		},
		verify: async (request, binding): Promise<StartedSession> => {
			verifiedWith.push(binding);
			const owner = { ownerId: newId<"owner">(), walletAddress: request.walletAddress };
			signedIn = owner;
			return { token: "a-very-long-session-token", expiresAt: clock.now(), owner };
		},
		ownerOf: async (headers) =>
			headers.get("cookie")?.includes("maschina_session") ? signedIn : undefined,
		signOut: async (token) => {
			ended.push(token);
			signedIn = undefined;
		},
		linkWallet: async (_request, owner) => owner,
	};
	return { ports, ended, challenged, verifiedWith };
}

let auth: ReturnType<typeof fakeAuth>;
const app = (secure = false, domain?: string) =>
	buildApp({
		version: "1",
		corsOrigins: [],
		logger,
		clock,
		machines: noMachines,
		auth: auth.ports,
		cookie: { secure, ...(domain === undefined ? {} : { domain }) },
	});

beforeEach(() => {
	auth = fakeAuth();
});

/** What a browser sends back once it has asked for a sentence: the secret the gateway gave it. */
const ASKED = { cookie: "maschina_siws=a-browser-secret" };

const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
	app().request(path, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

describe("asking for something to sign", () => {
	it("hands back the exact sentence and the nonce it answers", async () => {
		const { address } = await wallet();
		const res = await post("/v1/auth/challenge", { walletAddress: address });

		expect(res.status).toBe(200);
		const body = (await res.json()) as { message: string; nonce: string };
		expect(body.message).toContain(address);
		expect(body.nonce).toBe("abc123");
	});

	it("gives the browser a secret in a cookie only it holds, and the verifier its own copy", async () => {
		const { address } = await wallet();
		const res = await post("/v1/auth/challenge", { walletAddress: address });
		const cookie = res.headers.get("set-cookie") ?? "";

		expect(cookie).toMatch(/maschina_siws=[A-Za-z0-9_-]{40,}/);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/v1/auth");
		// Host only: no other address under the domain is ever sent it.
		expect(cookie).not.toContain("Domain=");
		const secret = /maschina_siws=([^;]+)/.exec(cookie)?.[1];
		expect(auth.challenged).toEqual([secret]);
	});

	it("gives each ask a secret of its own", async () => {
		const { address } = await wallet();
		const one = (await post("/v1/auth/challenge", { walletAddress: address })).headers.get(
			"set-cookie",
		);
		const two = (await post("/v1/auth/challenge", { walletAddress: address })).headers.get(
			"set-cookie",
		);

		expect(one).not.toBe(two);
	});

	it("refuses anything that is not an address", async () => {
		expect((await post("/v1/auth/challenge", { walletAddress: "nope" })).status).toBe(400);
	});
});

describe("returning it signed", () => {
	const signIn = async () => {
		const { address, sign } = await wallet();
		const message = `localhost wants you to sign in with your Solana account:\n${address}`;
		return post(
			"/v1/auth/verify",
			{ walletAddress: address, message, signature: await sign(message) },
			ASKED,
		);
	};

	it("puts the session in a cookie script cannot read", async () => {
		const res = await signIn();
		const cookie = res.headers.get("set-cookie") ?? "";

		expect(res.status).toBe(200);
		expect(cookie).toContain("maschina_session=");
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
	});

	it("refuses to finish a sign in from a browser that never asked, and starts nothing", async () => {
		const { address, sign } = await wallet();
		const message = `localhost wants you to sign in with your Solana account:\n${address}`;
		const res = await post("/v1/auth/verify", {
			walletAddress: address,
			message,
			signature: await sign(message),
		});

		expect(res.status).toBe(401);
		expect(res.headers.get("set-cookie") ?? "").not.toContain("maschina_session=");
		expect(auth.verifiedWith).toEqual([]);
	});

	it("hands the verifier the secret this browser holds, and spends it", async () => {
		const res = await signIn();

		expect(auth.verifiedWith).toEqual(["a-browser-secret"]);
		expect(res.headers.get("set-cookie") ?? "").toContain("maschina_siws=;");
	});

	it("leaves the token out of the body, where script could reach it", async () => {
		const body = await (await signIn()).text();

		expect(body).not.toContain("a-very-long-session-token");
		expect(JSON.parse(body)).toMatchObject({ walletAddress: expect.any(String) });
	});

	it("marks the cookie secure and shares it with the app's domain in production", async () => {
		auth = fakeAuth();
		const { address, sign } = await wallet();
		const message = `localhost wants you to sign in with your Solana account:\n${address}`;
		const res = await app(true, ".maschina.dev").request("/v1/auth/verify", {
			method: "POST",
			headers: { "content-type": "application/json", ...ASKED },
			body: JSON.stringify({ walletAddress: address, message, signature: await sign(message) }),
		});
		const cookie = res.headers.get("set-cookie") ?? "";

		expect(cookie).toContain("Secure");
		expect(cookie).toContain("Domain=.maschina.dev");
	});

	it("refuses a signature that is not even the right shape", async () => {
		const { address } = await wallet();
		const res = await post("/v1/auth/verify", {
			walletAddress: address,
			message: "anything",
			signature: "short",
		});

		expect(res.status).toBe(400);
	});
});

describe("who am I", () => {
	it("answers nobody without a session", async () => {
		const res = await app().request("/v1/auth/me");

		expect(res.status).toBe(401);
		expect((await res.json()) as { error: { code: string } }).toMatchObject({
			error: { code: "unauthenticated" },
		});
	});

	it("answers the owner once signed in", async () => {
		const { address, sign } = await wallet();
		const message = `localhost wants you to sign in with your Solana account:\n${address}`;
		await post(
			"/v1/auth/verify",
			{ walletAddress: address, message, signature: await sign(message) },
			ASKED,
		);

		const res = await app().request("/v1/auth/me", {
			headers: { cookie: "maschina_session=a-very-long-session-token" },
		});

		expect(res.status).toBe(200);
		expect((await res.json()) as { walletAddress: string }).toMatchObject({
			walletAddress: address,
		});
	});
});

describe("signing out", () => {
	it("ends the session and clears the cookie", async () => {
		const res = await post("/v1/auth/sign-out", undefined, {
			cookie: "maschina_session=a-very-long-session-token",
		});

		expect(res.status).toBe(204);
		expect(auth.ended).toEqual(["a-very-long-session-token"]);
		expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	it("is not an error when nobody was signed in", async () => {
		expect((await post("/v1/auth/sign-out")).status).toBe(204);
		expect(auth.ended).toEqual([]);
	});
});
