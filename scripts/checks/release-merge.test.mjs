/**
 * The release pull request has to be found to merge itself. The step finds it by its branch name, and
 * release-please's real branch name is checked here against the step's own filter, run through jq the
 * way the workflow runs it. An exact match once found nothing, and releases sat unmerged for a day.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
	new URL("../../.github/workflows/release.yml", import.meta.url),
	"utf8",
);
const filter = /--jq '([^']+)'/.exec(
	workflow.slice(workflow.indexOf("Merge the release pull request")),
)?.[1];

const pick = (prs) =>
	execFileSync("jq", ["-r", filter], { input: JSON.stringify(prs) })
		.toString()
		.trim();

test("the merge step has a filter to run", () => {
	assert.ok(filter, "no --jq filter found in the merge step");
});

test("finds release-please's pull request by the branch name it really uses", () => {
	const prs = [
		{ number: 12, headRefName: "feat/something" },
		{ number: 741, headRefName: "release-please--branches--main--components--maschina" },
	];
	assert.equal(pick(prs), "741");
});

test("finds nothing when there is no release pull request open", () => {
	assert.equal(pick([{ number: 12, headRefName: "feat/something" }]), "");
});
