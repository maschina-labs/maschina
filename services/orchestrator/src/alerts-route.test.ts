import { newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { type AlertStore, alertOnWire } from "./alerts-route.ts";
import { buildApp } from "./app.ts";

const daemonToken = "d".repeat(40);
const botsToken = "b".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });
const ownerId = newId<"owner">();

const alert = {
	eventId: newId<"event">(),
	ownerId,
	machineId: newId<"machine">(),
	machineName: "Range Finder",
	type: "trade.completed",
	occurredAt: "2026-09-29T02:00:00.000Z",
	realised: "1010000",
};

function app(store: AlertStore, bots: string | null = botsToken) {
	return buildApp({
		version: "1.0.0",
		daemonToken,
		...(bots === null ? {} : { botsToken: bots }),
		alerts: store,
		logger,
		checks: [],
		runs: { claim: async () => ({ ok: true, value: undefined }) },
		reports: { report: async () => ({ ok: true, value: undefined }) },
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
		states: { stateOf: async () => undefined },
		withdrawer: {
			withdraw: async () => {
				throw new Error("not used here");
			},
			withdrawEverything: async () => {
				throw new Error("not used here");
			},
		},
		renewals: { renew: async () => ({ ok: true, value: undefined }) },
	} as never);
}

const store = (overrides: Partial<AlertStore> = {}): AlertStore => ({
	pending: vi.fn(async () => [alert]),
	delivered: vi.fn(async () => undefined),
	...overrides,
});

const asBots = { authorization: `Bearer ${botsToken}` };
const since = "2026-09-28T00:00:00.000Z";

describe("alerts for the bots", () => {
	it("hands over what these owners have not been told", async () => {
		const alerts = store();
		const res = await app(alerts).request(
			`/alerts/v1/pending?channel=telegram&owner=${ownerId}&since=${since}`,
			{ headers: asBots },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ alerts: [alert] });
		expect(alerts.pending).toHaveBeenCalledWith({
			channel: "telegram",
			ownerIds: [ownerId],
			since: new Date(since),
		});
	});

	it("takes word back once an alert went out", async () => {
		const alerts = store();
		const res = await app(alerts).request("/alerts/v1/delivered", {
			method: "POST",
			headers: { ...asBots, "content-type": "application/json" },
			body: JSON.stringify({ eventId: alert.eventId, channel: "telegram" }),
		});

		expect(res.status).toBe(200);
		expect(alerts.delivered).toHaveBeenCalledWith({ eventId: alert.eventId, channel: "telegram" });
	});

	it.each([
		["a channel it does not know", `channel=fax&owner=${ownerId}&since=${since}`],
		["an owner that is not an id", `channel=telegram&owner=ash&since=${since}`],
		["no moment to start from", `channel=telegram&owner=${ownerId}`],
	])("refuses %s", async (_what, query) => {
		const res = await app(store()).request(`/alerts/v1/pending?${query}`, { headers: asBots });
		expect(res.status).toBe(400);
	});

	it("refuses a delivery it cannot read", async () => {
		const res = await app(store()).request("/alerts/v1/delivered", {
			method: "POST",
			headers: { ...asBots, "content-type": "application/json" },
			body: "{}",
		});
		expect(res.status).toBe(400);
	});

	it("answers nobody without the bots' token, and not a node", async () => {
		const res = await app(store()).request(
			`/alerts/v1/pending?channel=telegram&owner=${ownerId}&since=${since}`,
			{ headers: { authorization: `Bearer ${daemonToken}` } },
		);
		expect(res.status).toBe(401);
	});

	it("has no alerts at all when no bots token is set", async () => {
		const res = await app(store(), null).request(
			`/alerts/v1/pending?channel=telegram&owner=${ownerId}&since=${since}`,
			{ headers: asBots },
		);
		expect(res.status).toBe(404);
	});
});

describe("an alert on the wire", () => {
	it("spells amounts as digits and moments as ISO strings, and leaves out what is not there", () => {
		expect(
			alertOnWire({
				...alert,
				occurredAt: new Date(alert.occurredAt),
				trade: {
					inputMint: "So11111111111111111111111111111111111111112",
					outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					inputAmount: 339_698_787n,
					outputAmount: 41_360_000n,
				},
				realised: -120_000n,
			}),
		).toMatchObject({
			occurredAt: alert.occurredAt,
			trade: { inputAmount: "339698787", outputAmount: "41360000" },
			realised: "-120000",
		});
		const bare = alertOnWire({
			...alert,
			occurredAt: new Date(alert.occurredAt),
			realised: undefined,
		} as never);
		expect("trade" in bare || "reason" in bare).toBe(false);
	});
});
