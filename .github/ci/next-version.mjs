#!/usr/bin/env node
/**
 * Work out the next version from the commits since the last release tag.
 *
 *   node .github/ci/next-version.mjs
 *
 * Prints `version=<x.y.z>` and `bump=<major|minor|patch>` on stdout, and appends
 * the same to `$GITHUB_OUTPUT` when running in Actions. Prints nothing and exits
 * 0 when nothing since the last tag warrants a release, which is the common
 * case: a docs fix does not deserve a version.
 *
 * Conventional commits decide it, because the commit subject is already
 * required to be one (`.github/workflows/pr.yml`) and squash merging makes the
 * pull request title the subject. So the version follows from a rule that is
 * already enforced, rather than from someone remembering.
 *
 * While the major is 0 a breaking change bumps the minor, not the major. That
 * is what 0.x means: the public surface is not promised yet. See
 * `internal/operations/RELEASING.md`.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const git = (...args) =>
	execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** Commit subjects since the last `v*` tag, or the whole history if there is none. */
function subjectsSinceLastTag() {
	let range;
	try {
		range = `${git("describe", "--tags", "--abbrev=0", "--match", "v*")}..HEAD`;
	} catch {
		range = "HEAD";
	}
	const log = git("log", "--format=%B%x00", range);
	return log
		.split("\0")
		.map((message) => message.trim())
		.filter((message) => message.length > 0);
}

// A type not listed here produces no release. That is deliberate: docs, ci,
// test, style and plain chore cannot change how Maschina behaves, and a version
// that moves without behaviour changing makes the number mean less.
const PATCH_TYPES = new Set(["fix", "perf", "refactor", "revert"]);

export function bumpFor(messages) {
	let bump = null;
	const rank = { patch: 1, minor: 2, major: 3 };
	const raise = (next) => {
		if (bump === null || rank[next] > rank[bump]) bump = next;
	};

	for (const message of messages) {
		const [subject] = message.split("\n");
		const match = /^([a-z]+)(\([^)]*\))?(!)?:/.exec(subject);
		if (match === null) continue;
		const [, type, scope, breaking] = match;

		if (breaking !== undefined || /^BREAKING[ -]CHANGE:/m.test(message)) {
			raise("major");
			continue;
		}
		if (type === "feat") {
			raise("minor");
			continue;
		}
		if (PATCH_TYPES.has(type)) {
			raise("patch");
			continue;
		}
		// Dependency bumps are the one kind of chore and build that ships code.
		if ((type === "chore" || type === "build") && scope === "(deps)") raise("patch");
	}

	return bump;
}

/**
 * The next version, given the current one and what the commits earned.
 *
 * **Version components are integers, not decimal places.** `0.9.0` becomes
 * `0.10.0`, then `0.11.0`, and so on without limit. Nothing rolls over, because
 * there is nothing to roll over into: these are three separate numbers that
 * happen to be written with dots between them.
 *
 * `1.0.0` is never reached by arithmetic. While the major is 0 even a breaking
 * change moves the minor, which is what 0.x means: nothing is promised yet.
 * Going to 1.0 is a person deciding that the ten proof criteria hold under real
 * use, and typing it.
 */
export function nextVersion(current, bump) {
	const [major, minor, patch] = current.split(".").map(Number);
	if (bump === "major") return major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
	if (bump === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

// Only when run directly. Importing this file, which the test does, must not
// read package.json or shell out to git.
if (process.argv[1]?.endsWith("next-version.mjs")) {
	const current = JSON.parse(readFileSync("package.json", "utf8")).version;
	const bump = bumpFor(subjectsSinceLastTag());

	if (bump === null) {
		console.error("Nothing since the last tag warrants a release.");
		process.exit(0);
	}

	const version = nextVersion(current, bump);
	const output = `bump=${bump}\nversion=${version}\n`;
	process.stdout.write(output);
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
}
