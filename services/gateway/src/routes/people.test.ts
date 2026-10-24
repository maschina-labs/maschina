/**
 * People signing in with an email, Google, GitHub or their company, and a wallet linked afterwards, through the API.
 *
 * Better Auth answers its own routes, so these tests check what the gateway adds around them: that the request reaches
 * it untouched, that it is slowed down when somebody hammers it, that it says so when it is not switched on, and that
 * linking a wallet needs a signed in owner and never takes the address from the request alone.
 */

import { ManualClock, MaschinaError } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { AuthPorts } from "./auth.ts";
import type { Owner } from "./machines.ts";

const logger = createLogger({ service: "t", level: "silent" });
const clock = new ManualClock("2026-10-10T12:00:00.000Z");
const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

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

const person: Owner = { ownerId: "owner-1", walletAddress: null, email: "a@example.com" };

function auth(over: Partial<AuthPorts> = {}): AuthPorts {
	return {
		challenge: async () => ({ message: "m", nonce: "n", expiresAt: "2026-10-10T12:05:00.000Z" }),
		verify: async () => {
			throw new Error("not used here");
		},
		ownerOf: async (headers) => (headers.get("cookie") ? person : undefined),
		signOut: async () => undefined,
		linkWallet: async (_request, owner) => ({ ...owner, walletAddress: WALLET }),
		...over,
	};
}

function app(people?: { handler(request: Request): Promise<Response> }, ports = auth()) {
	return buildApp({
		version: "1",
		corsOrigins: [],
		logger,
		clock,
		machines: noMachines,
		auth: ports,
		cookie: { secure: false },
		...(people ? { people } : {}),
	});
}

describe("Better Auth's routes", () => {
	it("hand the request to Better Auth as it came, path and body and cookie", async () => {
		const seen: Request[] = [];
		const res = await app({
			handler: async (request) => {
				seen.push(request);
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			},
		}).request("/v1/auth/people/sign-in/email", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: "a=b" },
			body: JSON.stringify({ email: "a@example.com" }),
		});
		expect(res.status).toBe(200);
		expect(new URL(seen[0]?.url ?? "").pathname).toBe("/v1/auth/people/sign-in/email");
		expect(seen[0]?.headers.get("cookie")).toBe("a=b");
		expect(await seen[0]?.json()).toEqual({ email: "a@example.com" });
	});

	it("also answer a GET, which is how a link in an email and a redirect from Google arrive", async () => {
		const res = await app({ handler: async () => new Response("hi", { status: 302 }) }).request(
			"/v1/auth/people/verify-email?token=t",
		);
		expect(res.status).toBe(302);
	});

	it("say they are not available here when Better Auth is not switched on", async () => {
		const res = await app().request("/v1/auth/people/sign-in/email", { method: "POST" });
		expect(res.status).toBe(503);
		expect(JSON.stringify(await res.json())).toContain("not available");
	});

	it("slow down somebody who keeps asking", async () => {
		const server = app({ handler: async () => new Response("ok") });
		const statuses: number[] = [];
		for (let i = 0; i < 14; i++) {
			statuses.push(
				(await server.request("/v1/auth/people/sign-in/email", { method: "POST" })).status,
			);
		}
		expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
		expect(statuses.at(-1)).toBe(429);
	});
});

describe("linking a wallet", () => {
	const body = JSON.stringify({ walletAddress: WALLET, message: "m", signature: "s".repeat(88) });
	const post = (server: ReturnType<typeof app>, headers: Record<string, string> = {}) =>
		server.request("/v1/auth/link-wallet", {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body,
		});

	it("needs somebody signed in, and links nothing for nobody", async () => {
		const linked: unknown[] = [];
		const res = await post(
			app(
				undefined,
				auth({
					linkWallet: async (r) => {
						linked.push(r);
						return person;
					},
				}),
			),
		);
		expect(res.status).toBe(401);
		expect(linked).toEqual([]);
	});

	it("refuses to link from a browser that did not ask for the sentence, and links nothing", async () => {
		const linked: unknown[] = [];
		const res = await post(
			app(
				undefined,
				auth({
					linkWallet: async (r) => {
						linked.push(r);
						return person;
					},
				}),
			),
			{ cookie: "session=1" },
		);
		expect(res.status).toBe(401);
		expect(linked).toEqual([]);
	});

	it("links the wallet that signed the sentence to the owner who is signed in, and says who they are now", async () => {
		const seen: { owner: Owner; address: string }[] = [];
		const res = await post(
			app(
				undefined,
				auth({
					linkWallet: async (request, owner) => {
						seen.push({ owner, address: request.walletAddress });
						return { ...owner, walletAddress: request.walletAddress };
					},
				}),
			),
			{ cookie: "session=1; maschina_siws=a-browser-secret" },
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			ownerId: "owner-1",
			walletAddress: WALLET,
			email: "a@example.com",
		});
		expect(seen[0]).toMatchObject({ owner: { ownerId: "owner-1" }, address: WALLET });
	});

	it("passes on a refusal, such as a wallet that already belongs to somebody else", async () => {
		const res = await post(
			app(
				undefined,
				auth({
					linkWallet: async () => {
						throw new MaschinaError("conflict", "that wallet already belongs to another owner");
					},
				}),
			),
			{ cookie: "session=1; maschina_siws=a-browser-secret" },
		);
		expect(res.status).toBe(409);
	});
});
