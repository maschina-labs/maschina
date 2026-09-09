/**
 * Which operations change the world.
 *
 * `03-RUNTIME` §2: a step is one decision effect and at most one world effect.
 * This is that line, and it decides who is allowed to judge an objective
 * (`09-EVALUATION` §4), so getting it wrong either lets an executor accept its
 * own work or stops an evaluator forming an opinion at all.
 */

import { describe, expect, it } from "vitest";
import { changesTheWorld } from "./capability.ts";

describe("changesTheWorld", () => {
	it("counts touching a filesystem", () => {
		expect(changesTheWorld("write")).toBe(true);
		expect(changesTheWorld("create")).toBe(true);
		expect(changesTheWorld("delete")).toBe(true);
		expect(changesTheWorld("read")).toBe(true);
	});

	it("counts pushing a commit", () => {
		expect(changesTheWorld("commit")).toBe(true);
	});

	it("does not count asking a model", () => {
		// The one that broke a real run. An evaluator that used a model to form
		// its opinion counted as having worked on the objective, and was refused
		// when it went to record the verdict. An evaluator that may not think
		// cannot judge.
		expect(changesTheWorld("invoke")).toBe(false);
	});

	it("does not count recording a verdict", () => {
		// Judging is a decision about work, not more of the work.
		expect(changesTheWorld("evaluate")).toBe(false);
	});

	it("splits the operations into exactly the two groups the runtime names", () => {
		// Stated as a whole rather than one at a time, so adding an operation
		// without deciding which side it falls on fails here rather than silently
		// defaulting somewhere.
		const world = ["read", "write", "create", "delete", "commit"] as const;
		const decision = ["invoke", "evaluate"] as const;
		expect(world.every(changesTheWorld)).toBe(true);
		expect(decision.some(changesTheWorld)).toBe(false);
	});
});
