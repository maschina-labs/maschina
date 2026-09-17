import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossmint } from "./crossmint.ts";
import { turnkey } from "./turnkey.ts";

const turnkeyEnv = {
	apiPublicKey: "02abc",
	apiPrivateKey: "secret",
	organizationId: "0b1c8e5e-7c3b-4f55-9e57-6c2b4f0a9d11",
	apiBaseUrl: "https://api.turnkey.com",
};

describe("turnkey ping", () => {
	it("reports the organisation the credentials belong to", async () => {
		const provider = turnkey(turnkeyEnv, () => ({
			getWhoami: async ({ organizationId }) => ({
				organizationId,
				organizationName: "Maschina",
				userId: "u",
				username: "spike",
			}),
		}));
		assert.deepEqual(await provider.ping(), { ok: true, detail: "organization Maschina as spike" });
	});

	it("fails when the credentials belong to a different organisation", async () => {
		const provider = turnkey(turnkeyEnv, () => ({
			getWhoami: async () => ({
				organizationId: "other",
				organizationName: "Other",
				userId: "u",
				username: "x",
			}),
		}));
		const result = await provider.ping();
		assert.equal(result.ok, false);
		assert.match(result.detail, /different organization/);
	});

	it("reports a refused request without leaking the key", async () => {
		const provider = turnkey(turnkeyEnv, () => ({
			getWhoami: async () => {
				throw new Error("401 unauthorized");
			},
		}));
		const result = await provider.ping();
		assert.equal(result.ok, false);
		assert.match(result.detail, /401/);
		assert.ok(!result.detail.includes("secret"));
	});
});

describe("crossmint ping", () => {
	const env = { apiKey: "sk_staging_secret", apiBaseUrl: "https://staging.crossmint.com" };

	const respond =
		(status: number, seen?: { url?: string; key?: string | null }) =>
		async (input: string | URL | Request, init?: RequestInit) => {
			if (seen) {
				seen.url = String(input);
				seen.key = new Headers(init?.headers).get("x-api-key");
			}
			return new Response("{}", { status });
		};

	it("accepts the key when the API answers past authentication", async () => {
		const seen: { url?: string; key?: string | null } = {};
		const provider = crossmint(env, respond(404, seen));
		assert.deepEqual(await provider.ping(), { ok: true, detail: "key accepted (staging)" });
		assert.ok(seen.url?.startsWith("https://staging.crossmint.com/api/2025-06-09/wallets/"));
		assert.equal(seen.key, "sk_staging_secret");
	});

	it("fails when the key is refused", async () => {
		for (const status of [401, 403]) {
			const result = await crossmint(env, respond(status)).ping();
			assert.equal(result.ok, false);
			assert.match(result.detail, /refused/);
			assert.ok(!result.detail.includes("secret"));
		}
	});

	it("fails on anything else, including server errors and network failures", async () => {
		assert.equal((await crossmint(env, respond(500)).ping()).ok, false);
		const offline = crossmint(env, async () => {
			throw new Error("getaddrinfo ENOTFOUND");
		});
		const result = await offline.ping();
		assert.equal(result.ok, false);
		assert.match(result.detail, /ENOTFOUND/);
	});
});
