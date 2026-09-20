import { newId } from "@maschina/core";
import type { OwnedMachineDetail, StoredEvent } from "@maschina/db";
import { describe, expect, it } from "vitest";
import { asDetail, asRecord, asSummary } from "./shapes.ts";

const SOL = "So11111111111111111111111111111111111111112";

const machine: OwnedMachineDetail = {
	machineId: newId<"machine">(),
	name: "SOL dip buyer",
	kind: "price_trigger",
	walletAddress: SOL,
	createdAt: new Date("2026-09-21T09:00:00Z"),
	state: "running",
	budget: { granted: 20_000_000n, reserved: 5_000n, settled: 1_000n, available: 19_994_000n },
	settings: { level: "142000000" },
	limits: { maxPerTrade: 5_000_000n, maxPerDay: undefined, approvedMints: [SOL] },
	actions: ["pause", "stop"],
};

describe("what the API says about a machine", () => {
	it("carries amounts as digits and times as ISO strings", () => {
		expect(asSummary(machine)).toMatchObject({
			createdAt: "2026-09-21T09:00:00.000Z",
			budget: { granted: "20000000", available: "19994000" },
		});
	});

	it("leaves out a limit nobody set, rather than calling it zero", () => {
		const detail = asDetail(machine);
		expect(detail.limits).toEqual({ maxPerTrade: "5000000", approvedMints: [SOL] });
		expect("maxPerDay" in detail.limits).toBe(false);
	});

	it("says why a machine is paused when the record knows", () => {
		const paused = {
			...machine,
			state: "paused" as const,
			stateReason: "budget nearly spent",
		};
		expect(asSummary(paused)).toMatchObject({ stateReason: "budget nearly spent" });
		expect("stateReason" in asSummary(machine)).toBe(false);
	});
});

describe("what the API says a machine did", () => {
	const event = (n: number): StoredEvent =>
		({
			id: newId<"event">(),
			machineId: machine.machineId,
			type: "run.finished",
			occurredAt: new Date(Date.UTC(2026, 8, 21, 9, n)),
			payload: { n },
		}) as unknown as StoredEvent;

	it("gives the newest first, and only as many as were asked for", () => {
		const events = [event(1), event(2), event(3)];
		const record = asRecord(events, 2);

		expect(record).toHaveLength(2);
		expect(record.map((entry) => (entry.payload as unknown as { n: number }).n)).toEqual([3, 2]);
		expect(record[0]?.occurredAt).toBe("2026-09-21T09:03:00.000Z");
	});
});
