#!/usr/bin/env node
/**
 * The README has to still be true.
 *
 * A front page that lists apps, services and packages drifts the moment one is added or renamed, and
 * a stale front page is worse than a short one: it is the first thing anybody reads and the last
 * thing anybody edits. So the parts that can be checked mechanically, are.
 *
 * What this checks:
 *   - every app, service and package on disk is named in the Layout block
 *   - nothing is named there that does not exist
 *   - the links to other files in this repository point at files that exist
 *   - the honest status lines are still present, because they are the ones that must never quietly go
 *
 * What it cannot check is whether the prose is still accurate. That is a person's job.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Every way the README can be provably wrong, as a list of sentences. Empty means it still holds. */
export function checkReadme(root) {
	const readme = readFileSync(join(root, "README.md"), "utf8");
	const problems = [];

	/** The directories whose contents the README promises to list. */
	const WORKSPACES = ["apps", "services", "packages"];

	const layout = readme.match(/## Layout\n+```text\n([\s\S]*?)```/)?.[1];
	if (!layout) {
		problems.push("the README has no Layout block, so nothing can be checked against the tree");
	} else {
		for (const workspace of WORKSPACES) {
			// A workspace that does not exist has nothing the README could be missing.
			if (!existsSync(join(root, workspace))) continue;
			const onDisk = readdirSync(join(root, workspace), { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);

			for (const name of onDisk) {
				// Word boundaries, so "app" does not match inside "apps/" or "accounts".
				if (!new RegExp(`\\b${name}\\b`).test(layout)) {
					problems.push(`${workspace}/${name} exists and the README's Layout does not mention it`);
				}
			}
		}
	}

	/** Links into this repository, which are the ones that can rot silently. */
	for (const [, target] of readme.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
		const path = target.split("#")[0];
		if (path && !existsSync(join(root, path))) {
			problems.push(`the README links to ${path}, which does not exist`);
		}
	}

	/**
	 * The lines that keep the README honest. Losing one is how a project starts overclaiming without
	 * anybody deciding to. If a claim here genuinely stops being true, change it here and in the README
	 * in the same commit, on purpose.
	 */
	const MUST_SAY = [
		["has not had an independent security audit", "that there has been no independent audit"],
		["no outside users", "that there are no outside users"],
		["Source-available", "that the code is source-available"],
		["Not open source", "that the code is not open source"],
	];

	for (const [phrase, what] of MUST_SAY) {
		if (!readme.includes(phrase)) {
			problems.push(`the README no longer says ${what} ("${phrase}")`);
		}
	}

	return problems;
}

const here = new URL("../../", import.meta.url).pathname;
const problems = checkReadme(here);

if (problems.length > 0) {
	console.error("The README has drifted:\n");
	for (const problem of problems) console.error(`  ${problem}`);
	console.error("\nFix the README, or the check, whichever is actually wrong.\n");
	process.exit(1);
}

console.log("The README still matches the repository.");
