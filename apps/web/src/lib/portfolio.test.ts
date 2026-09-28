import { describe, expect, it } from "vitest";
import type { MachineSummary, RecordEntry } from "./machines.ts";
import { activityOf, totalsOf } from "./portfolio.ts";

const machine = (
	id: string,
	state: MachineSummary["state"],
	granted: string,
	realised: string,
	simulated = false,
) =>
	({
		machineId: id,
		name: `Machine ${id}`,
		state,
		budget: { granted },
		result: { realised, position: "1000000000", trades: 2, simulated },
	}) as MachineSummary;

const event = (id: string, at: string): RecordEntry => ({
	id,
	type: "trade.completed",
	occurredAt: at,
	payload: {},
});

describe("the portfolio", () => {
	it("adds every machine up, losses included", () => {
		const totals = totalsOf([
			machine("a", "running", "40600000", "370000"),
			machine("b", "stopped", "28000000", "-120000"),
		]);

		expect(totals).toEqual({
			machines: 2,
			running: 1,
			granted: 68_600_000n,
			realised: 250_000n,
			holding: 2_000_000_000n,
			trades: 4,
			simulated: false,
		});
	});

	it("says when any of it is paper", () => {
		expect(totalsOf([machine("a", "running", "1", "0", true)]).simulated).toBe(true);
	});

	it("is all zero with no machines", () => {
		expect(totalsOf([]).granted).toBe(0n);
	});
});

describe("activity across machines", () => {
	it("merges every record into one feed, newest first, naming the machine", () => {
		const feed = activityOf([
			{
				machine: machine("a", "running", "1", "0"),
				events: [event("1", "2026-09-28T05:20:00Z"), event("3", "2026-09-28T07:00:00Z")],
			},
			{ machine: machine("b", "running", "1", "0"), events: [event("2", "2026-09-28T06:00:00Z")] },
		]);

		expect(feed.map((entry) => [entry.id, entry.machineName])).toEqual([
			["3", "Machine a"],
			["2", "Machine b"],
			["1", "Machine a"],
		]);
	});

	it("keeps only the most recent", () => {
		const events = Array.from({ length: 5 }, (_, i) => event(String(i), `2026-09-28T0${i}:00:00Z`));
		expect(activityOf([{ machine: machine("a", "running", "1", "0"), events }], 2)).toHaveLength(2);
	});
});
