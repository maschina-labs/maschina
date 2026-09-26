import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import {
	decideFor,
	levelsOf,
	type MachineKind,
	type MachineView,
	registryOf,
} from "./machine-kind.ts";

const view: MachineView = {
	balances: new Map(),
	availableBudget: baseUnitsOf(0n),
	now: new Date("2026-06-15T15:00:00Z"),
	totals: { spent: baseUnitsOf(0n), buys: 0 },
};

const kind = (name: string): MachineKind<{ ok: boolean }> => ({
	kind: name,
	readSettings: (settings) =>
		typeof settings === "object" && settings !== null
			? { ok: true, value: { ok: true } }
			: { ok: false, problem: "settings are missing" },
	decide: () => ({ decide: "wait", because: "not_due" }),
});

describe("registryOf", () => {
	it("looks a kind up by name", () => {
		const registry = registryOf([kind("one"), kind("two")] as never);
		expect(registry.get("one")?.kind).toBe("one");
		expect(registry.get("missing")).toBeUndefined();
	});

	it("refuses two kinds with the same name, which would silently shadow one", () => {
		expect(() => registryOf([kind("same"), kind("same")] as never)).toThrow(/both called same/);
	});

	it("is empty when nothing is registered", () => {
		expect(registryOf([]).size).toBe(0);
	});
});

describe("decideFor", () => {
	it("reads the settings, then decides", () => {
		expect(decideFor(kind("one") as MachineKind<unknown>, {}, view)).toEqual({
			decide: "wait",
			because: "not_due",
		});
	});

	it("waits with the problem when the settings can't be read, instead of deciding on nonsense", () => {
		const decision = decideFor(kind("one") as MachineKind<unknown>, null, view);
		expect(decision).toMatchObject({ decide: "wait", detail: "settings are missing" });
	});
});

describe("levelsOf", () => {
	const SOL = "So11111111111111111111111111111111111111112";
	const watching: MachineKind<{ ok: boolean }> = {
		...kind("range"),
		levels: () => [
			{
				id: "low",
				pricedMint: SOL,
				level: baseUnitsOf(120_000_000n),
				direction: "falls_to",
				hysteresisBps: 50,
				minGapMs: 60_000,
			},
			{
				id: "high",
				pricedMint: SOL,
				level: baseUnitsOf(130_000_000n),
				direction: "rises_to",
				hysteresisBps: 50,
				minGapMs: 60_000,
			},
		],
	};

	const registry = registryOf([watching, kind("plain")] as never);

	it("gives every level a kind is waiting on", () => {
		const levels = levelsOf(registry, "range", {});

		expect(levels.map((level) => level.id)).toEqual(["low", "high"]);
		expect(levels[0]).toMatchObject({ level: 120_000_000n, direction: "falls_to" });
	});

	it("gives nothing for a kind that waits on no price at all", () => {
		expect(levelsOf(registry, "plain", {})).toEqual([]);
	});

	it("gives nothing for a kind nobody registered", () => {
		expect(levelsOf(registry, "sniper", {})).toEqual([]);
	});

	it("gives nothing when the settings cannot be read, rather than guessing a level", () => {
		// A level made up from half-read settings would queue runs the owner never asked for.
		expect(levelsOf(registry, "range", null)).toEqual([]);
	});

	it("refuses two levels sharing a name, which would share one crossing between them", () => {
		const clashing = registryOf([
			{
				...watching,
				kind: "clash",
				levels: () => [
					{
						id: "edge",
						pricedMint: SOL,
						level: baseUnitsOf(1n),
						direction: "falls_to",
						hysteresisBps: 0,
						minGapMs: 0,
					},
					{
						id: "edge",
						pricedMint: SOL,
						level: baseUnitsOf(2n),
						direction: "rises_to",
						hysteresisBps: 0,
						minGapMs: 0,
					},
				],
			},
		] as never);

		expect(() => levelsOf(clashing, "clash", {})).toThrow(/two levels/);
	});
});
