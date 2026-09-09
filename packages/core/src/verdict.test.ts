/**
 * The rollup.
 *
 * This decides whether an objective is done, which is the question the whole
 * system exists to answer. Getting it wrong in the generous direction puts false
 * completions in a permanent record; getting it wrong in the strict direction
 * throws away real work.
 */

import { describe, expect, it } from "vitest";
import { outcomeFor, remaining, rollup, type Verdict } from "./verdict.ts";

const verdict = (result: Verdict["result"], criterionId = "c1"): Verdict => ({
	criterionId,
	result,
	evidence: ["some evidence"],
	method: "mechanical",
	notes: "",
});

describe("rollup", () => {
	it("is accomplished when every criterion is satisfied", () => {
		expect(rollup([verdict("satisfied", "c1"), verdict("satisfied", "c2")])).toBe(
			"accomplished",
		);
	});

	it("is indeterminate when there is nothing to judge", () => {
		// An empty contract satisfies vacuously, and vacuous satisfaction is the
		// exact shape of a Goodhart failure. Not being able to tell is the honest
		// answer to "did you meet no criteria".
		expect(rollup([])).toBe("indeterminate");
	});

	it("is partial when some are satisfied and some are not", () => {
		// Normal, not a failure. Most objectives satisfy some criteria first, and
		// per-criterion verdicts are what make the rest visible.
		expect(rollup([verdict("satisfied", "c1"), verdict("not_satisfied", "c2")])).toBe(
			"partial",
		);
	});

	it("is not accomplished when nothing was satisfied", () => {
		expect(rollup([verdict("not_satisfied", "c1"), verdict("not_satisfied", "c2")])).toBe(
			"not_accomplished",
		);
	});

	it("lets one indeterminate outweigh every satisfied criterion", () => {
		// The rule that must not be softened. If any part cannot be judged, the
		// objective cannot be judged, and any other ordering lets an unknown be
		// outvoted by the parts that happened to be checkable.
		expect(
			rollup([
				verdict("satisfied", "c1"),
				verdict("satisfied", "c2"),
				verdict("indeterminate", "c3"),
			]),
		).toBe("indeterminate");
	});

	it("lets one indeterminate outweigh a failure too", () => {
		// Rounding to failure is the quieter mistake and still a mistake: it
		// discards real work and closes an objective nobody actually judged.
		expect(rollup([verdict("not_satisfied", "c1"), verdict("indeterminate", "c2")])).toBe(
			"indeterminate",
		);
	});

	it("never returns a boolean's worth of information", () => {
		// Four outcomes, not two. A boolean cannot express "some of it" or
		// "cannot tell", and both are ordinary.
		const results = new Set([
			rollup([verdict("satisfied")]),
			rollup([verdict("not_satisfied")]),
			rollup([verdict("indeterminate")]),
			rollup([verdict("satisfied", "a"), verdict("not_satisfied", "b")]),
		]);
		expect(results.size).toBe(4);
	});
});

describe("outcomeFor", () => {
	it("suspends on indeterminate rather than guessing", () => {
		expect(outcomeFor("indeterminate")).toBe("suspended");
	});

	it("keeps a partial objective active with work remaining", () => {
		// Not failed. The work that was done is still done.
		expect(outcomeFor("partial")).toBe("active");
	});

	it("accomplishes and fails the unambiguous cases", () => {
		expect(outcomeFor("accomplished")).toBe("accomplished");
		expect(outcomeFor("not_accomplished")).toBe("failed");
	});

	it("never turns indeterminate into accomplished or failed", () => {
		// Stated as its own test because it is the single rule in this file that
		// would be most tempting to soften under delivery pressure.
		expect(outcomeFor("indeterminate")).not.toBe("accomplished");
		expect(outcomeFor("indeterminate")).not.toBe("failed");
	});
});

describe("remaining", () => {
	it("names what is left, so a worker does not start over", () => {
		expect(
			remaining([
				verdict("satisfied", "c1"),
				verdict("not_satisfied", "c2"),
				verdict("indeterminate", "c3"),
			]),
		).toEqual(["c2", "c3"]);
	});

	it("is empty when everything is satisfied", () => {
		expect(remaining([verdict("satisfied", "c1")])).toEqual([]);
	});

	it("counts indeterminate as remaining, not as done", () => {
		expect(remaining([verdict("indeterminate", "c1")])).toEqual(["c1"]);
	});
});
