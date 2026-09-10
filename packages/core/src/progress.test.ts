/**
 * Whether a worker is getting anywhere.
 *
 * The rule the plan warns about: stuck is not slow. `03-RUNTIME` §8 is about a
 * worker producing nothing, not about a worker taking a while, and conflating
 * them either kills careful work or lets a circling worker run until the budget
 * stops it.
 */

import { describe, expect, it } from "vitest";
import { foldProgress, isNullStep, type StepOutcome, stalled } from "./progress.ts";

const step = (overrides: Partial<StepOutcome> = {}): StepOutcome => ({
	artifacts: [],
	observations: [],
	changedTheWorld: false,
	satisfied: [],
	...overrides,
});

describe("isNullStep", () => {
	it("is null when nothing came of it", () => {
		expect(isNullStep(step())).toBe(true);
	});

	it("is not null when something was produced", () => {
		expect(isNullStep(step({ artifacts: ["file.txt"] }))).toBe(false);
	});

	it("is not null when something was learned", () => {
		// A step that tried something and found it did not work is progress: the
		// worker knows something it did not know before. Counting that as null is
		// how a system punishes a worker for investigating.
		expect(isNullStep(step({ observations: ["the migration lock was held"] }))).toBe(false);
	});

	it("is not null when the world changed", () => {
		expect(isNullStep(step({ changedTheWorld: true }))).toBe(false);
	});

	it("is not null when a criterion was met", () => {
		expect(isNullStep(step({ satisfied: ["c1"] }))).toBe(false);
	});
});

describe("foldProgress", () => {
	it("counts nothing at the start", () => {
		expect(foldProgress([])).toEqual({
			steps: 0,
			consecutiveNulls: 0,
			satisfied: [],
			artifacts: [],
		});
	});

	it("counts null steps in a row", () => {
		expect(foldProgress([step(), step(), step()]).consecutiveNulls).toBe(3);
	});

	it("resets the count on any progress at all", () => {
		// A worker that got somewhere once is not stuck, however long it circled
		// before. Otherwise a long objective accumulates its way into a stall.
		const progress = foldProgress([
			step(),
			step(),
			step({ observations: ["something"] }),
			step(),
		]);
		expect(progress.consecutiveNulls).toBe(1);
	});

	it("does not count slow as stuck", () => {
		// Twenty steps that each produced something is twenty steps of work. The
		// plan warns about this specifically: stuck is not took too long.
		const working = Array.from({ length: 20 }, (_, i) => step({ observations: [`step ${i}`] }));
		expect(foldProgress(working).consecutiveNulls).toBe(0);
		expect(foldProgress(working).steps).toBe(20);
	});

	it("keeps criteria in the order they were satisfied", () => {
		const progress = foldProgress([step({ satisfied: ["c2"] }), step({ satisfied: ["c1"] })]);
		expect(progress.satisfied).toEqual(["c2", "c1"]);
	});

	it("does not count a criterion twice", () => {
		const progress = foldProgress([step({ satisfied: ["c1"] }), step({ satisfied: ["c1"] })]);
		expect(progress.satisfied).toEqual(["c1"]);
	});
});

describe("stalled", () => {
	const criteria = ["c1", "c2", "c3"];

	it("is not stalled below the limit", () => {
		expect(stalled(foldProgress([step(), step()]), criteria, "tried X").stuck).toBe(false);
	});

	it("is stalled at the limit", () => {
		expect(stalled(foldProgress([step(), step(), step()]), criteria, "tried X").stuck).toBe(
			true,
		);
	});

	it("is never stalled while producing something, however many steps", () => {
		const many = Array.from({ length: 50 }, () => step({ observations: ["learned a thing"] }));
		expect(stalled(foldProgress(many), criteria, "tried X").stuck).toBe(false);
	});

	it("asks something a person can answer, not that it is stuck", () => {
		// Criterion 3. "It is stuck" is a status. This has to be a question.
		const stall = stalled(
			foldProgress([step({ satisfied: ["c1"] }), step(), step(), step()]),
			criteria,
			"writing to the deploy directory, which was refused",
		);
		expect(stall.question).toContain("c2, c3");
		expect(stall.question).toContain("writing to the deploy directory");
		expect(stall.question).toMatch(/\?$/);
	});

	it("says what is already done, so nobody redoes it", () => {
		const stall = stalled(
			foldProgress([step({ satisfied: ["c1"] }), step(), step(), step()]),
			criteria,
			"tried X",
		);
		expect(stall.question).toContain("1 of 3");
		expect(stall.question).toContain("c1");
	});

	it("says why it stopped, separately from what it is asking", () => {
		const stall = stalled(foldProgress([step(), step(), step()]), criteria, "tried X");
		expect(stall.reason).toContain("no artifact, no observation");
		expect(stall.reason).not.toContain("?");
	});

	it("copes with having satisfied nothing", () => {
		const stall = stalled(foldProgress([step(), step(), step()]), criteria, "tried X");
		expect(stall.question).toContain("nothing yet");
	});
});
