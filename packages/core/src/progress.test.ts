/**
 * Whether a worker is getting anywhere.
 *
 * The rule the plan warns about: stuck is not slow. `03-RUNTIME` §8 is about a
 * worker producing nothing, not about a worker taking a while, and conflating
 * them either kills careful work or lets a circling worker run until the budget
 * stops it.
 */

import { describe, expect, it } from "vitest";
import {
	foldProgress,
	isNewObservation,
	isNullStep,
	type StepOutcome,
	stalled,
} from "./progress.ts";

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
		// Twenty steps that each learned something different is twenty steps of
		// work. The plan warns about this specifically: stuck is not took too long.
		//
		// The observations have to actually differ. An earlier version of this
		// test used "step 0", "step 1" and so on, which is a worker narrating a
		// counter rather than reporting findings, and that now counts as
		// repetition. The fixture was the lazy part, not the rule.
		const findings = [
			"the remote has no tags",
			"the manifest version is 0.0.0",
			"no workflow mentions publishing",
			"the default branch is protected",
			"there is no changelog file",
			"the maintainer uses squash merges",
			"pull requests are titled conventionally",
			"CI runs on every push",
			"coverage is enforced at 80 percent",
			"the sandbox repository is separate",
			"commits are signed",
			"nobody has ever pushed a release",
			"issues are disabled",
			"the licence file is MIT",
			"there are two collaborators",
			"the README is one paragraph",
			"dependabot is not configured",
			"the history begins in March",
			"one branch exists besides main",
			"the last commit was yesterday",
		];
		const working = findings.map((finding) => step({ observations: [finding] }));
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
		// Each step produces an artifact, which is progress no matter how it is
		// worded. Fifty identical observations would be repetition and would
		// correctly stall, which is what the live run of criterion 3 caught.
		const many = Array.from({ length: 50 }, (_, i) => step({ artifacts: [`file-${i}.txt`] }));
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

describe("an observation only counts if it says something new", () => {
	// These are the real refusals from the first live run of criterion 3, where a
	// model was asked eight times to document a release process that does not
	// exist. Every one of them is a different sentence saying the same thing, and
	// under the original rule each reset the null counter, so the worker ran to
	// its step ceiling and never asked anybody anything.
	const REFUSALS = [
		"INSUFFICIENT: The commit history shows no evidence of any release process being used, such as version bumps, tags, release commits, or changelog entries.",
		"INSUFFICIENT: The commit history contains no evidence of any release process, such as version tags, release commits, changelogs, or version bumps.",
		"INSUFFICIENT: The commit history contains no evidence of a release process, such as version tags, release commits, version bumps, or changelog updates.",
		"INSUFFICIENT: The commit history contains no evidence of releases, version tags, changelog updates, or any release-related commits.",
	];

	const said = (text: string): StepOutcome => ({
		artifacts: [],
		observations: [text],
		changedTheWorld: false,
		satisfied: [],
	});

	it("treats a reworded repeat as a repeat", () => {
		expect(isNewObservation(REFUSALS[1] as string, [REFUSALS[0] as string])).toBe(false);
	});

	it("still treats a genuinely different finding as new", () => {
		expect(
			isNewObservation("the history has 3 commits and none of them is a release", [
				REFUSALS[0] as string,
			]),
		).toBe(true);
	});

	it("stalls on rewording, which is the bug the live run found", () => {
		const progress = foldProgress(REFUSALS.map(said));
		// First one is new. The three restatements are not.
		expect(progress.consecutiveNulls).toBe(3);
		expect(stalled(progress, ["exists", "accurate"], "asking again").stuck).toBe(true);
	});

	it("does not stall a worker that keeps learning different things", () => {
		const progress = foldProgress([
			said("the remote has no tags at all"),
			said("the package manifest version is 0.0.0"),
			said("no workflow file mentions publishing"),
			said("the maintainer has never opened a release pull request"),
		]);
		expect(progress.consecutiveNulls).toBe(0);
	});

	it("counts an artifact as progress even when the words repeat", () => {
		const progress = foldProgress([
			said(REFUSALS[0] as string),
			said(REFUSALS[1] as string),
			{
				artifacts: ["RELEASING.md"],
				observations: [REFUSALS[2] as string],
				changedTheWorld: true,
				satisfied: [],
			},
		]);
		expect(progress.consecutiveNulls).toBe(0);
	});
});
