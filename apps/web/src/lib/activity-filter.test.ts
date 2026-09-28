import { describe, expect, it } from "vitest";
import { byDay, filterActivity } from "./activity-filter.ts";
import type { ActivityEntry } from "./portfolio.ts";

const entry = (id: string, type: string, machineId: string, at: string): ActivityEntry => ({
	id,
	type,
	occurredAt: at,
	payload: {},
	machineId,
	machineName: machineId,
});

const feed = [
	entry("1", "trade.completed", "a", "2026-09-28T12:00:00Z"),
	entry("2", "run.skipped", "a", "2026-09-28T11:00:00Z"),
	entry("3", "machine.started", "b", "2026-09-27T12:00:00Z"),
	entry("4", "trade.refused", "b", "2026-09-27T11:00:00Z"),
];

describe("narrowing the feed", () => {
	it("keeps only trades, problems or machine changes when asked", () => {
		expect(filterActivity(feed, "TRADES").map((e) => e.id)).toEqual(["1"]);
		expect(filterActivity(feed, "PROBLEMS").map((e) => e.id)).toEqual(["2", "4"]);
		expect(filterActivity(feed, "MACHINE").map((e) => e.id)).toEqual(["3"]);
		expect(filterActivity(feed, "ALL")).toHaveLength(4);
	});

	it("keeps only one machine when one is picked", () => {
		expect(filterActivity(feed, "ALL", "b").map((e) => e.id)).toEqual(["3", "4"]);
	});
});

describe("the feed by day", () => {
	it("groups entries under their day, keeping their order", () => {
		const days = byDay(feed);
		expect(days).toHaveLength(2);
		expect(days[0]?.entries.map((e) => e.id)).toEqual(["1", "2"]);
	});
});
