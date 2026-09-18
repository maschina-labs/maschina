import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { decideFor, type MachineKind, type MachineView, registryOf } from "./machine-kind.ts";

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
