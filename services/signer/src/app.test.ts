import { MaschinaError } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

const token = "s".repeat(40);
const app = (checks: { name: string; check: () => Promise<boolean> }[] = []) =>
	buildApp({
		checks,
		version: "1.0.0",
		orchestratorToken: token,
		logger: createLogger({ service: "t", level: "silent" }),
		signer: {
			sign: async () => {
				throw new MaschinaError("unavailable", "not used here");
			},
		},
		withdrawer: {
			withdraw: async () => {
				throw new MaschinaError("unavailable", "not used here");
			},
			withdrawEverything: async () => {
				throw new MaschinaError("unavailable", "not used here");
			},
		},
		sweeper: {
			sweep: async () => {
				throw new MaschinaError("unavailable", "not used here");
			},
		},
	});

describe("signer", () => {
	it("reports health", async () => {
		expect((await app().request("/health")).status).toBe(200);
		expect((await app().request("/ready")).status).toBe(200);
	});

	it("is not ready when it cannot reach the chain, and says that is why", async () => {
		// A signer that cannot reach Solana can sign and never send. Production ran like that, with every
		// call refused, and /ready said it was fine because nobody had asked it about the chain.
		const cannot = app([{ name: "solana", check: async () => false }]);
		const answer = await cannot.request("/ready");

		expect(answer.status).toBe(503);
		expect(await answer.json()).toMatchObject({ failing: ["solana"] });
	});

	it("only answers the orchestrator", async () => {
		expect((await app().request("/internal/v1/hello")).status).toBe(401);
		const ok = await app().request("/internal/v1/hello", {
			headers: { authorization: `Bearer ${token}` },
		});
		expect(ok.status).toBe(200);
	});

	it("refuses large requests", async () => {
		const res = await app().request("/internal/v1/hello", {
			method: "POST",
			body: "x".repeat(65 * 1024),
			headers: { authorization: `Bearer ${token}`, "content-length": String(65 * 1024) },
		});
		expect(res.status).toBe(413);
	});
});
