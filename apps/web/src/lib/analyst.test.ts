import { describe, expect, it } from "vitest";
import { briefOn } from "./analyst.ts";
import type { MachineSummary } from "./machines.ts";

const machine = (state: MachineSummary["state"], position = "0", basis = "0") =>
	({
		kind: "range",
		state,
		result: { position, basis, realised: "0" },
	}) as unknown as MachineSummary;

describe("the analyst's brief", () => {
	it("says how a holding stands, and that a fixed range has no floor, most important first", () => {
		const brief = briefOn(machine("running", "339698000", "40350000"), [], 117.0);

		expect(brief[0]).toEqual({
			level: "watch",
			text: "HOLDING 0.33 SOL · PAID 118.78 · DOWN 1.5%",
		});
		expect(brief[1]?.text).toContain("NO FLOOR");
	});

	it("counts runs that did nothing and problems, from the record", () => {
		const record = [
			{ id: "1", type: "run.skipped", occurredAt: "", payload: {} },
			{ id: "2", type: "trade.refused", occurredAt: "", payload: {} },
		];
		const texts = briefOn(machine("running"), record, 117).map((finding) => finding.text);

		expect(texts).toContain("1 RUNS DID NOTHING · EACH ONE SAYS WHY IN THE LOG");
		expect(texts[0]).toBe("1 TRADES FAILED OR WERE REFUSED");
	});

	it("says a stopped machine should be emptied", () => {
		expect(briefOn(machine("stopped"), [], 117).map((finding) => finding.text)).toContain(
			"STOPPED · WITHDRAW WHAT IT HOLDS",
		);
	});
});
