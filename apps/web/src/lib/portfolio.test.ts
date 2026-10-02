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
	it("counts budgets and holdings only for machines that can still act, and realized profit for all", () => {
		const totals = totalsOf([
			machine("a", "running", "40600000", "370000"),
			machine("b", "stopped", "28000000", "-120000"),
		]);

		expect(totals).toEqual({
			machines: 2,
			running: 1,
			// The stopped machine's 28 is history, not money at work.
			granted: 40_600_000n,
			realized: 250_000n,
			holding: 1_000_000_000n,
			trades: 4,
		});
	});

	it("never adds paper to live: each side has its own totals", () => {
		const all = [
			machine("live", "running", "40600000", "370000"),
			machine("sandbox", "running", "100000000", "900000", true),
		];
		const live = totalsOf(all);
		const paper = totalsOf(all, "paper");

		expect(live.machines).toBe(1);
		expect(live.granted).toBe(40_600_000n);
		expect(live.realized).toBe(370_000n);
		expect(paper.machines).toBe(1);
		expect(paper.granted).toBe(100_000_000n);
		expect(paper.realized).toBe(900_000n);
	});

	it("takes a machine's own paper flag over anything in its result", () => {
		const flagged = { ...machine("x", "running", "5", "0"), paper: true } as MachineSummary;
		expect(totalsOf([flagged]).machines).toBe(0);
		expect(totalsOf([flagged], "paper").machines).toBe(1);
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
