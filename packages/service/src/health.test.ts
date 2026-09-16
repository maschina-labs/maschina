import { ManualClock } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { createServiceApp } from "./app.ts";
import { registerHealth } from "./health.ts";
import { memoryLogger } from "./test-logger.ts";

const clock = new ManualClock("2026-09-16T12:00:00.000Z");

function app(
	checks: { name: string; check: () => Promise<boolean> }[] = [],
	checkTimeoutMs?: number,
) {
	const service = createServiceApp({ service: "orchestrator", logger: memoryLogger().logger });
	registerHealth(service, {
		service: "orchestrator",
		version: "1.2.3",
		checks,
		clock,
		...(checkTimeoutMs === undefined ? {} : { checkTimeoutMs }),
	});
	return service;
}

describe("health", () => {
	it("reports the process is up", async () => {
		const res = await app().request("/health");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			status: "ok",
			service: "orchestrator",
			version: "1.2.3",
			time: "2026-09-16T12:00:00.000Z",
		});
	});

	it("is ready when every check passes", async () => {
		const res = await app([{ name: "database", check: async () => true }]).request("/ready");
		expect(res.status).toBe(200);
	});

	it("is not ready when a check fails, throws or hangs, and names it", async () => {
		const res = await app(
			[
				{ name: "database", check: async () => false },
				{
					name: "rpc",
					check: async () => {
						throw new Error("down");
					},
				},
				{ name: "slow", check: () => new Promise(() => {}) },
				{ name: "fine", check: async () => true },
			],
			20,
		).request("/ready");
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({
			status: "degraded",
			failing: ["database", "rpc", "slow"],
		});
	});
});
