#!/usr/bin/env node
/**
 * Cut a release.
 *
 *   pnpm release 0.2.0
 *
 * Moves whatever is under `## [Unreleased]` into a dated version heading, bumps
 * the root version, and prints the git commands to run. It does not touch git
 * itself.
 *
 * The changelog is written by hand and stays that way. This does not generate
 * release notes from commit subjects, because a changelog assembled from commit
 * subjects reads like a commit log, which is the thing a changelog exists to
 * save people from reading.
 */

import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
	console.error("Usage: pnpm release <version>    e.g. pnpm release 0.2.0");
	process.exit(1);
}

const CHANGELOG = "CHANGELOG.md";
const PACKAGE = "package.json";

const changelog = readFileSync(CHANGELOG, "utf8");
const marker = "## [Unreleased]";

if (!changelog.includes(marker)) {
	console.error(`${CHANGELOG} has no "${marker}" heading.`);
	process.exit(1);
}

// Everything between [Unreleased] and the next version heading, or the end.
const after = changelog.slice(changelog.indexOf(marker) + marker.length);
const nextHeading = after.search(/^## \[/m);
const unreleased = (nextHeading === -1 ? after : after.slice(0, nextHeading)).trim();

if (unreleased.length === 0) {
	console.error(
		"Nothing under [Unreleased]. A release with no changelog entry is a release\n" +
			"nobody can read. Write what changed first.",
	);
	process.exit(1);
}

if (changelog.includes(`## [${version}]`)) {
	console.error(`${CHANGELOG} already has a section for ${version}.`);
	process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(CHANGELOG, changelog.replace(marker, `${marker}\n\n## [${version}] - ${today}`));

const pkg = JSON.parse(readFileSync(PACKAGE, "utf8"));
const previous = pkg.version;
pkg.version = version;
writeFileSync(PACKAGE, `${JSON.stringify(pkg, null, "\t")}\n`);

console.log(`\n  ${previous} -> ${version}\n`);
console.log("  CHANGELOG.md and package.json updated. Review the diff, then:\n");
console.log("    pnpm check && pnpm typecheck && pnpm test && pnpm proof");
console.log(`    git add CHANGELOG.md package.json`);
console.log(`    git commit -m "chore(release): ${version}"`);
console.log(`    git tag -a v${version} -m "v${version}"`);
console.log(`    git push && git push --tags\n`);
console.log("  The tag push creates the GitHub Release from this changelog section.\n");
