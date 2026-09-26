import { err, MaschinaError, newId, ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import type { LeaseRenewals } from "./renew-route.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });
const nodeId = newId<"node">();
const runId = newId<"run">();

function app(renewals: LeaseRenewals) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [],
		runs: { claim: async () => ok(undefined) },
		reports: { report: async () => ok(undefined) },
		contexts: { contextFor: async () => undefined },
		leases: { holds: async () => undefined },
		paperSigner: {
			simulate: async () => {
				throw new Error("not used here");
			},
		},
		signer: {
			sign: async () => {
				throw new Error("not used here");
			},
		},
		renewals,
	});
}

const renew = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/renew", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("a node renewing its lease", () => {
	it("gets the new expiry when it still holds the run", async () => {
		const asked: unknown[] = [];
		const res = await renew(
			app({
				renew: async (lease) => {
					asked.push(lease);
					return ok(new Date("2026-09-21T09:02:00Z"));
				},
			}),
			{ nodeId, runId, leaseEpoch: "4" },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ leaseExpiresAt: "2026-09-21T09:02:00.000Z" });
		expect(asked).toEqual([{ nodeId, runId, leaseEpoch: 4n }]);
	});

	it("is refused once the run has moved on", async () => {
		const res = await renew(
			app({ renew: async () => err(new MaschinaError("conflict", "the lease is no longer held")) }),
			{ nodeId, runId, leaseEpoch: "4" },
		);
		expect(res.status).toBe(409);
	});

	it("refuses a malformed renewal", async () => {
		const res = await renew(app({ renew: async () => ok(new Date()) }), { nodeId, runId });
		expect(res.status).toBe(400);
	});
});
