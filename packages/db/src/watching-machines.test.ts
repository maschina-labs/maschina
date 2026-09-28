import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { machinesWatchingPrices, recordRecentre } from "./watching-machines.ts";

// Against a real database this is proved in packages/integration-tests.

const machineId = newId<"machine">();
const event = (type: string, payload: object) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type,
	payload,
	occurred_at: "2026-09-21T09:00:00.000Z",
});

const running = [
	event("machine.limits_changed", { limit: "budgetGranted", from: null, to: "1000" }),
	event("machine.started", {}),
];

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

const row = { id: machineId, kind: "price_trigger", settings: { level: "142000000" } };

describe("machinesWatchingPrices", () => {
	it("lists a machine that is running", async () => {
		const watching = await machinesWatchingPrices(fakeDatabase([row], running));
		expect(watching).toEqual([
			expect.objectContaining({ machineId, kind: "price_trigger", settings: row.settings }),
		]);
	});

	it("hands over the record it read, for a kind whose levels follow what it has done", async () => {
		const [watching] = await machinesWatchingPrices(fakeDatabase([row], running));
		expect(watching?.events?.map((each) => each.type)).toEqual([
			"machine.limits_changed",
			"machine.started",
		]);
	});

	it("leaves out a machine that is not running", async () => {
		const paused = [...running, event("machine.paused", { reason: "owner" })];
		expect(await machinesWatchingPrices(fakeDatabase([row], paused))).toEqual([]);
	});

	it("asks for nothing else when no machine waits on a price", async () => {
		expect(await machinesWatchingPrices(fakeDatabase([]))).toEqual([]);
	});
});

describe("recordRecentre", () => {
	it("writes where the band now sits, as a checked event", async () => {
		const execute = vi.fn(async () => [{ id: newId<"event">(), occurred_at: new Date() }]);
		const db = { execute } as unknown as Database;

		const written = await recordRecentre(db, {
			machineId,
			price: 121_500_000n,
			because: "followed",
		});

		expect(written.ok).toBe(true);
		expect(JSON.stringify(execute.mock.calls)).toContain("machine.recentred");
	});
});
