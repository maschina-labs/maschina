import { describe, expect, it } from "vitest";
import type { MachineDetail } from "./machines.ts";
import { bandOf, statusOf } from "./status.ts";

const machine = (state: MachineDetail["state"], position = "0") =>
	({
		state,
		settings: { buyLevel: "118800000", sellLevel: "121200000" },
		result: { position },
	}) as unknown as MachineDetail;

describe("what a machine is doing", () => {
	it("waits to buy while it holds nothing", () => {
		expect(statusOf(machine("running"))).toBe("WAITING TO BUY AT 118.80");
	});

	it("waits to sell while it holds a position", () => {
		expect(statusOf(machine("running", "339000000"))).toBe("HOLDING · SELLS AT 121.20");
	});

	it("says its state when it is not running", () => {
		expect(statusOf(machine("paused"))).toBe("PAUSED");
	});
});

describe("the band on the chart", () => {
	it("gives the sell line above the buy line, in dollars", () => {
		expect(bandOf(machine("running"))).toEqual([
			{ price: 121.2, label: "SELL" },
			{ price: 118.8, label: "BUY" },
		]);
	});
});
