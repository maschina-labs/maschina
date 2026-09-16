#!/usr/bin/env node
/**
 * Decides which CI jobs a change needs, so a release or docs-only pull request finishes in seconds.
 *
 * When in doubt it runs everything. Skipping a check that was needed is far worse than running one
 * that wasn't.
 *
 * Usage: BASE_SHA=<sha> HEAD_SHA=<sha> node scripts/ci/changes.mjs
 * Prints `code`, `images` and `affected` as `name=true|false` lines for $GITHUB_OUTPUT. `affected` is
 * true only when the base commit was read, which is when checking just the affected packages is safe.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Files that never change how the code builds or runs. */
const NOT_CODE = [
	/\.md$/,
	/^\.release-please-manifest\.json$/,
	/^\.github\/ISSUE_TEMPLATE\//,
	/^\.github\/CODEOWNERS$/,
	/^\.github\/labels\.yml$/,
	/^\.vscode\//,
];

/** Files that go into a service image, or decide how one is built. */
const SHIPPED = [
	/^services\//,
	/^packages\//,
	/^docker\//,
	/^pnpm-lock\.yaml$/,
	/^pnpm-workspace\.yaml$/,
	/^package\.json$/,
	/^\.dockerignore$/,
	/^\.nvmrc$/,
	/^\.github\/workflows\/ci\.yml$/,
	/^\.github\/actions\//,
];

const EVERYTHING = Object.freeze({ code: true, images: true });
const FULL_RUN = Object.freeze({ ...EVERYTHING, affected: false });

/**
 * @param {string[] | null} files changed paths, or null when they couldn't be read
 * @param {{ versionOnly?: string[] }} [options] manifests whose only change is the version
 */
export function classify(files, { versionOnly = [] } = {}) {
	if (!files || files.length === 0) return { ...EVERYTHING };
	const code = files.filter(
		(file) => !versionOnly.includes(file) && !NOT_CODE.some((pattern) => pattern.test(file)),
	);
	return {
		code: code.length > 0,
		images: code.some((file) => SHIPPED.some((pattern) => pattern.test(file))),
	};
}

/** True when two package.json texts differ only in their version. */
export function onlyVersionChanged(before, after) {
	try {
		const a = JSON.parse(before);
		const b = JSON.parse(after);
		delete a.version;
		delete b.version;
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		return false;
	}
}

/** Reads the real diff between two commits and classifies it. */
export function detectChanges({ base, head = "HEAD", cwd = process.cwd() }) {
	if (!base || /^0+$/.test(base)) return { ...FULL_RUN };
	const git = (...args) =>
		execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	try {
		const files = git("diff", "--name-only", `${base}...${head}`).split("\n").filter(Boolean);
		const versionOnly = files.filter(
			(file) =>
				file === "package.json" &&
				onlyVersionChanged(git("show", `${base}:${file}`), git("show", `${head}:${file}`)),
		);
		if (files.length === 0) return { ...FULL_RUN };
		return { ...classify(files, { versionOnly }), affected: true };
	} catch {
		return { ...FULL_RUN };
	}
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
	const result = detectChanges({
		base: process.env.BASE_SHA,
		head: process.env.HEAD_SHA || "HEAD",
	});
	process.stdout.write(
		`code=${result.code}\nimages=${result.images}\naffected=${result.affected}\n`,
	);
}
