import { MaschinaError } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

const token = "s".repeat(40);
const app = () =>
	buildApp({
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
		},
	});

describe("signer", () => {
	it("reports health", async () => {
		expect((await app().request("/health")).status).toBe(200);
		expect((await app().request("/ready")).status).toBe(200);
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
