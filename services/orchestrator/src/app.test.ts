import { ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });

function app(databaseUp = true) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [{ name: "database", check: async () => databaseUp }],
		runs: { claim: async () => ok(undefined) },
		reports: { report: async () => ok(undefined) },
		contexts: { contextFor: async () => undefined },
		leases: { holds: async () => undefined },
		signer: {
			sign: async () => {
				throw new Error("not used here");
			},
		},
		paperSigner: {
			simulate: async () => ({
				status: "refused" as const,
				proposalId: "01a0da00-0000-7000-8000-000000000000",
				by: "maschina" as const,
				rule: "not used here",
				reason: "not used here",
			}),
		},
		renewals: { renew: async () => ok(new Date()) },
	});
}

describe("orchestrator", () => {
	it("reports health and readiness", async () => {
		expect((await app().request("/health")).status).toBe(200);
		expect((await app().request("/ready")).status).toBe(200);
	});

	it("is not ready without its database", async () => {
		const res = await app(false).request("/ready");
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ failing: ["database"] });
	});

	it("answers daemons that present the token", async () => {
		const res = await app().request("/internal/v1/hello", {
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ service: "orchestrator", version: "1.0.0" });
	});

	it("refuses internal calls without the token", async () => {
		expect((await app().request("/internal/v1/hello")).status).toBe(401);
	});
});
