import { describe, expect, it } from "vitest";
import { describeEvent } from "./describe.ts";

const entry = (type: string, payload: Record<string, unknown> = {}) => ({
	id: "e",
	type,
	occurredAt: "",
	payload,
});

describe("saying what a machine did", () => {
	it("names the ordinary moments plainly", () => {
		expect(describeEvent(entry("machine.started"))).toEqual({
			title: "STARTED",
			detail: "WATCHING THE PRICE",
		});
		expect(describeEvent(entry("machine.stopped")).title).toBe("STOPPED");
	});

	it("says where a following band moved to, in dollars", () => {
		expect(
			describeEvent(entry("machine.recentred", { price: "119017205", because: "followed" })),
		).toEqual({ title: "BAND MOVED", detail: "FOLLOWED THE PRICE TO $119.02" });
		expect(
			describeEvent(entry("machine.recentred", { price: "119017205", because: "started" })),
		).toEqual({ title: "BAND SET", detail: "AROUND $119.02" });
	});

	it("says when the owner changed the recipe", () => {
		expect(describeEvent(entry("machine.retuned", { from: "a", to: "b" })).title).toBe(
			"RECIPE CHANGED",
		);
	});

	it("gives the reason a run did nothing, without the code in front of it", () => {
		const skipped = entry("run.skipped", {
			detail: "limit_reached: this machine already holds a position, and holds one at a time",
		});
		expect(describeEvent(skipped)).toEqual({
			title: "DID NOTHING",
			detail: "THIS MACHINE ALREADY HOLDS A POSITION, AND HOLDS ONE AT A TIME",
		});
	});

	it("says what a trade spent and got", () => {
		const traded = entry("trade.completed", { inputAmount: "40350000", outputAmount: "339000000" });
		expect(describeEvent(traded)).toEqual({ title: "TRADED", detail: "SPENT 40.35 · GOT 0.33" });
	});

	it("still says something for a kind of entry it has no words for", () => {
		expect(describeEvent(entry("authority.used")).title).toBe("AUTHORITY USED");
	});
});
