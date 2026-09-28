import { describe, expect, it } from "vitest";
import { alertsFrom, unread } from "./alerts.ts";
import type { ActivityEntry } from "./portfolio.ts";

const entry = (id: string, type: string, at: string): ActivityEntry => ({
	id,
	type,
	occurredAt: at,
	payload: {},
	machineId: "m",
	machineName: "Range Finder",
});

const feed = [
	entry("1", "trade.completed", "2026-09-28T06:22:39Z"),
	entry("2", "run.skipped", "2026-09-28T07:06:08Z"),
	entry("3", "machine.stopped", "2026-09-28T08:00:00Z"),
];

describe("alerts", () => {
	it("keeps money moving and machines stopping, and leaves out routine skips", () => {
		expect(alertsFrom(feed).map((each) => each.id)).toEqual(["1", "3"]);
	});

	it("counts only what arrived after you last looked", () => {
		const alerts = alertsFrom(feed);
		expect(unread(alerts, undefined)).toBe(2);
		expect(unread(alerts, "2026-09-28T07:00:00Z")).toBe(1);
		expect(unread(alerts, "2026-09-28T09:00:00Z")).toBe(0);
	});
});
