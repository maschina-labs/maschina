import { ManualClock } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

const logger = createLogger({ service: "t", level: "silent" });
const clock = new ManualClock("2026-09-16T12:00:00.000Z");
/** Nothing in these tests reaches the machines API; its own file covers that. */
const noMachines = {
	ownerOf: async () => undefined,
	list: async () => [],
	read: async () => undefined,
	record: async () => [],
	act: async () => ({ state: "ready" }),
	create: async () => {
		throw new Error("not used here");
	},
};

const app = () =>
	buildApp({
		version: "1.2.3",
		corsOrigins: ["http://localhost:3000"],
		logger,
		clock,
		machines: noMachines,
	});

describe("gateway", () => {
	it("serves health outside the versioned API", async () => {
		expect((await app().request("/health")).status).toBe(200);
	});

	it("serves the status route with its documented shape", async () => {
		const res = await app().request("/v1/status");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			status: "ok",
			service: "gateway",
			version: "1.2.3",
			time: "2026-09-16T12:00:00.000Z",
		});
	});

	it("is usable through the typed client", async () => {
		const client = testClient(app());
		const res = await client.v1.status.$get();
		expect(res.status).toBe(200);
	});

	it("publishes an OpenAPI document that describes its routes", async () => {
		const doc = (await (await app().request("/openapi.json")).json()) as {
			openapi: string;
			info: { version: string };
			paths: Record<string, unknown>;
		};
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.info.version).toBe("1.2.3");
		expect(Object.keys(doc.paths)).toContain("/status");
	});

	it("allows the web app's origin and nobody else's", async () => {
		const allowed = await app().request("/v1/status", {
			headers: { origin: "http://localhost:3000" },
		});
		expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
		const other = await app().request("/v1/status", {
			headers: { origin: "https://evil.example" },
		});
		expect(other.headers.get("access-control-allow-origin")).toBeNull();
	});

	it("rate limits each client, refilling on the gateway's clock", async () => {
		const time = new ManualClock("2026-09-16T12:00:00.000Z");
		const gateway = buildApp({
			version: "1",
			corsOrigins: [],
			logger,
			clock: time,
			machines: noMachines,
		});
		const headers = { "x-real-ip": "203.0.113.9" };
		const status = async () => (await gateway.request("/v1/status", { headers })).status;

		for (let i = 0; i < 60; i++) expect(await status()).toBe(200);
		expect(await status()).toBe(429);
		// Two requests a second refill, so half a second restores exactly one.
		time.advance(499);
		expect(await status()).toBe(429);
		time.advance(1);
		expect(await status()).toBe(200);
		expect(await status()).toBe(429);
		const other = await gateway.request("/v1/status", {
			headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
		});
		expect(other.status).toBe(200);
	});

	it("counts the visitor behind Cloudflare, not the tunnel", async () => {
		const time = new ManualClock("2026-09-16T12:00:00.000Z");
		const gateway = buildApp({
			version: "1",
			corsOrigins: [],
			logger,
			clock: time,
			machines: noMachines,
		});
		// Cloudflare names the visitor; everything else in the chain is the tunnel talking about itself.
		const proxied = (ip: string) => ({
			"cf-connecting-ip": ip,
			"x-forwarded-for": "172.18.0.4",
			"x-real-ip": "172.18.0.4",
		});
		const status = async (ip: string) =>
			(await gateway.request("/v1/status", { headers: proxied(ip) })).status;

		for (let i = 0; i < 60; i++) expect(await status("203.0.113.9")).toBe(200);
		expect(await status("203.0.113.9")).toBe(429);
		expect(await status("198.51.100.7")).toBe(200);
	});

	it("uses the real clock when none is given", async () => {
		const res = await buildApp({
			version: "1",
			corsOrigins: [],
			logger,
			machines: noMachines,
		}).request("/v1/status");
		const body = (await res.json()) as { time: string };
		expect(Date.parse(body.time)).toBeGreaterThan(Date.parse("2026-01-01"));
	});
});
