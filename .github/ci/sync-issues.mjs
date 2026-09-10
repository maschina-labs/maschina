#!/usr/bin/env node
/**
 * Create issues from the manifest, and put them on the board.
 *
 * Idempotent by title: an issue whose title already exists is skipped rather
 * than duplicated, so this can be run again after adding rows to the manifest.
 *
 * Usage:  node .github/ci/sync-issues.mjs [--dry]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = "maschina-labs/maschina";
const DRY = process.argv.includes("--dry");

// GitHub's secondary rate limit on content creation is around eighty per minute,
// and tripping it fails the run halfway through with issues half made. A short
// wait between creations is cheaper than working out what got created.
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const gh = (args, input) =>
	execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 32 * 1024 * 1024 });

const manifest = readFileSync(new URL("./issues.jsonl", import.meta.url), "utf8")
	.split("\n")
	.filter((line) => line.trim())
	.map((line) => JSON.parse(line));

const existing = new Set(
	JSON.parse(
		gh([
			"issue",
			"list",
			"--repo",
			REPO,
			"--state",
			"all",
			"--limit",
			"1000",
			"--json",
			"title",
		]),
	).map((i) => i.title),
);

let made = 0;
let skipped = 0;
for (const issue of manifest) {
	if (existing.has(issue.title)) {
		skipped++;
		continue;
	}
	if (DRY) {
		console.log(`would create: ${issue.title}`);
		made++;
		continue;
	}
	const args = ["issue", "create", "--repo", REPO, "--title", issue.title, "--body-file", "-"];
	if (issue.milestone) args.push("--milestone", issue.milestone);
	for (const label of issue.labels ?? []) args.push("--label", label);
	const url = gh(args, issue.body).trim().split("\n").pop();
	gh(["project", "item-add", "1", "--owner", "maschina-labs", "--url", url]);
	console.log(`${url}  ${issue.title}`);
	made++;
	wait(1200);
}

console.log(`\n${made} created, ${skipped} already there.`);
