import { describe, expect, it } from "vitest";
import { AMBIENT, towersFrom } from "./towers.ts";

const machine = (trades: number, state: string, paper = false) =>
	({ state, paper, result: { trades } }) as Parameters<typeof towersFrom>[0][number];

describe("the towers, one for each machine", () => {
	it("stand taller the more a machine has done", () => {
		// Busiest first, as the towers are drawn front to back.
		const [busy, quiet] = towersFrom([machine(2, "running"), machine(80, "running")]);
		expect(busy?.height).toBeGreaterThan(quiet?.height ?? 1);
		expect(busy?.height).toBeLessThanOrEqual(1);
		expect(quiet?.height).toBeGreaterThan(0);
	});

	it("glow while running, dim when paused, faint when stopped, and see through on paper", () => {
		const [running, paused, stopped, paper] = towersFrom([
			machine(10, "running"),
			machine(10, "paused"),
			machine(10, "stopped"),
			machine(10, "running", true),
		]);
		expect(running?.glow).toBe(1);
		expect(paused?.glow).toBeLessThan(1);
		expect(stopped?.glow).toBeLessThan(paused?.glow ?? 0);
		expect(paper?.glow).toBeLessThan(running?.glow ?? 0);
	});

	it("keeps to twelve, the busiest first", () => {
		const many = Array.from({ length: 20 }, (_, index) => machine(index, "running"));
		const towers = towersFrom(many);
		expect(towers).toHaveLength(12);
		expect(towers[0]?.height).toBe(1);
	});

	it("with no machines, a few low quiet towers wait in the fog", () => {
		expect(towersFrom([])).toEqual(AMBIENT);
		expect(AMBIENT.every((tower) => tower.height < 0.4 && tower.glow < 0.4)).toBe(true);
	});
});
