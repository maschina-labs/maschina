import type { RecordedEvent } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { machineLimits, parseList, settledSince, type TimedEvent } from "./machine-limits.ts";

const machineId = newId<"machine">();
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const limitChange = (
	limit: "maxPerTrade" | "maxPerDay" | "approvedMints" | "recipients" | "budgetGranted",
	to: string,
	from: string | null = null,
): RecordedEvent => ({
	machineId,
	type: "machine.limits_changed",
	payload: { limit, from, to },
});

const completed = (inputAmount: string, occurredAt: Date): TimedEvent => ({
	machineId,
	type: "trade.completed",
	occurredAt,
	payload: {
		runId: newId<"run">(),
		tradeId: newId<"trade">(),
		signature:
			"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X",
		inputAmount,
		outputAmount: "1",
		feeLamports: "5000",
	},
});

describe("the limits an owner set", () => {
	it("is nothing at all for a machine with no limit events", () => {
		expect(machineLimits([])).toEqual({ approvedMints: [], recipients: [] });
	});

	it("takes the latest value of each limit", () => {
		const limits = machineLimits([
			limitChange("maxPerTrade", "100"),
			limitChange("maxPerDay", "1000"),
			limitChange("maxPerTrade", "250", "100"),
		]);

		expect(limits.maxPerTrade).toBe(250n);
		expect(limits.maxPerDay).toBe(1000n);
	});

	it("reads a list of tokens, trimming and dropping repeats", () => {
		const limits = machineLimits([limitChange("approvedMints", ` ${SOL}, ${USDC} ,${SOL}, `)]);

		expect(limits.approvedMints).toEqual([SOL, USDC]);
	});

	it("reads recipients the same way", () => {
		expect(machineLimits([limitChange("recipients", `${SOL},`)]).recipients).toEqual([SOL]);
	});

	it("treats an unreadable amount as no limit, rather than as no cap", () => {
		// The distinction matters: the trade rules refuse an unapproved token outright, and an absent
		// cap only means the owner set none.
		const limits = machineLimits([
			limitChange("maxPerTrade", "100"),
			limitChange("maxPerTrade", ""),
		]);

		expect(limits.maxPerTrade).toBeUndefined();
	});

	it("ignores the budget, which is counted rather than read", () => {
		const limits = machineLimits([limitChange("budgetGranted", "5000")]);

		expect(limits).toEqual({ approvedMints: [], recipients: [] });
	});

	it("ignores events that are not limit changes", () => {
		const started: RecordedEvent = { machineId, type: "machine.started", payload: {} };

		expect(machineLimits([started, limitChange("maxPerDay", "7")]).maxPerDay).toBe(7n);
	});

	it("reads an empty list as approving nothing", () => {
		const limits = machineLimits([
			limitChange("approvedMints", `${SOL},${USDC}`),
			limitChange("approvedMints", ""),
		]);

		expect(limits.approvedMints).toEqual([]);
	});
});

describe("reading a list from the record", () => {
	it.each([
		["", []],
		[" ", []],
		[",,", []],
		[SOL, [SOL]],
		[`${SOL},${USDC}`, [SOL, USDC]],
	])("reads %s", (text, expected) => {
		expect(parseList(text)).toEqual(expected);
	});
});

describe("what has been spent today", () => {
	const morning = new Date("2026-09-18T09:00:00.000Z");
	const midnight = new Date("2026-09-18T00:00:00.000Z");

	it("is nothing when nothing completed", () => {
		expect(settledSince([], midnight)).toBe(0n);
	});

	it("adds up completed trades since the moment given", () => {
		const events = [
			completed("100", new Date("2026-09-17T23:59:59.000Z")),
			completed("250", morning),
			completed("50", new Date("2026-09-18T14:00:00.000Z")),
		];

		expect(settledSince(events, midnight)).toBe(300n);
	});

	it("counts only what actually left the wallet", () => {
		const failed: TimedEvent = {
			machineId,
			type: "trade.failed",
			occurredAt: morning,
			payload: {
				runId: newId<"run">(),
				tradeId: newId<"trade">(),
				stage: "submit",
				reason: "it did not land",
			},
		};

		expect(settledSince([failed, completed("10", morning)], midnight)).toBe(10n);
	});

	it("counts a trade that happened exactly at the boundary", () => {
		expect(settledSince([completed("5", midnight)], midnight)).toBe(5n);
	});
});
