#!/usr/bin/env node
/**
 * Stacked branches that survive squash merges.
 *
 *   pnpm stack feat/second-part   start a branch on top of the one you're on
 *   pnpm restack                  move the current branch onto its updated parent, or onto main once
 *                                 the parent has merged, then push it
 *   node scripts/git/stack.mjs check <branch>   check a branch name, used by the pull request checks
 *
 * A squash merge rewrites the parent's commits into one new commit, so a plain rebase would try to
 * replay the parent's work again and conflict. Remembering where the branch started lets restack
 * replay only the branch's own commits.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = "main";
const REMOTE = "origin";
const TYPES = ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "revert"];
const BRANCH_NAME = new RegExp(`^(${TYPES.join("|")})/[a-z0-9]+(-[a-z0-9]+){0,2}$`);

/** Returns why a branch name is wrong, or null when it's fine. */
export function branchNameProblem(name) {
	if (typeof name === "string" && BRANCH_NAME.test(name)) return null;
	return `Branch '${name}' should look like feat/machine-list: a type, a slash, and one to three short words.`;
}

function gitIn(cwd) {
	const git = (...args) =>
		execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	git.try = (...args) => {
		try {
			return git(...args);
		} catch {
			return null;
		}
	};
	git.exists = (ref) => git.try("rev-parse", "--verify", "--quiet", ref) !== null;
	return git;
}

export function newStack({ cwd = process.cwd(), name, log = console.log }) {
	const problem = branchNameProblem(name);
	if (problem) throw new Error(problem);
	const git = gitIn(cwd);
	if (git.exists(`refs/heads/${name}`)) throw new Error(`Branch ${name} already exists.`);
	const parent = git("branch", "--show-current");
	if (!parent) throw new Error("Check out the branch you want to build on first.");

	const base = git("rev-parse", "HEAD");
	git("switch", "-q", "-c", name);
	if (parent !== MAIN) {
		git("config", `branch.${name}.stackparent`, parent);
		git("config", `branch.${name}.stackbase`, base);
	}
	log(`Created ${name} on top of ${parent}.`);
	log(`Open its pull request with: gh pr create --fill --base ${parent}`);
}

/** Asks GitHub whether a branch's pull request was merged. */
async function mergedOnGitHub(branch, cwd) {
	const out = execFileSync(
		"gh",
		["pr", "list", "--head", branch, "--state", "merged", "--json", "number", "--limit", "1"],
		{ cwd, encoding: "utf8" },
	);
	return JSON.parse(out).length > 0;
}

function rebase(git, cwd, args) {
	try {
		git("rebase", ...args);
	} catch (error) {
		const stopped = ["rebase-merge", "rebase-apply"].some((dir) =>
			existsSync(resolve(cwd, git("rev-parse", "--git-path", dir))),
		);
		if (!stopped) throw error;
		throw new Error(
			"The rebase stopped on a conflict. Fix the files, git add them, run git rebase --continue, then run pnpm restack again.",
		);
	}
}

export async function restack({
	cwd = process.cwd(),
	isMerged = mergedOnGitHub,
	log = console.log,
}) {
	const git = gitIn(cwd);
	const branch = git("branch", "--show-current");
	if (!branch) {
		throw new Error(
			"No branch is checked out. If a restack stopped on a conflict, finish it with git rebase --continue.",
		);
	}
	if (branch === MAIN) throw new Error("You're on main. Restack a feature branch.");
	if (git("status", "--porcelain"))
		throw new Error("There are uncommitted changes. Commit or stash them first.");

	git("fetch", "-q", "--prune", REMOTE);
	const parent = git.try("config", `branch.${branch}.stackparent`) ?? MAIN;

	if (parent === MAIN) {
		rebase(git, cwd, [`${REMOTE}/${MAIN}`]);
		log(`${branch} is up to date with ${MAIN}.`);
	} else {
		const base = git("config", `branch.${branch}.stackbase`);
		// The config is updated before rebasing, so running restack again after a conflict still works.
		if (git.exists(`refs/remotes/${REMOTE}/${parent}`)) {
			const remote = git("rev-parse", `${REMOTE}/${parent}`);
			const local = git.try("rev-parse", "--verify", "--quiet", `refs/heads/${parent}`);
			const ahead = local && git.try("merge-base", "--is-ancestor", remote, local) !== null;
			const target = ahead ? local : remote;
			git("config", `branch.${branch}.stackbase`, target);
			rebase(git, cwd, ["--onto", target, base, branch]);
			log(`${branch} now sits on the latest ${parent}.`);
		} else {
			if (!(await isMerged(parent, cwd))) {
				throw new Error(
					`${parent} was deleted without being merged, so ${branch} still depends on work that isn't on ${MAIN}. Nothing was changed.`,
				);
			}
			git("config", `branch.${branch}.stackparent`, MAIN);
			git("config", "--unset", `branch.${branch}.stackbase`);
			rebase(git, cwd, ["--onto", `${REMOTE}/${MAIN}`, base, branch]);
			log(`${parent} has merged, so ${branch} now sits on ${MAIN}.`);
		}
	}

	if (git.exists(`refs/remotes/${REMOTE}/${branch}`)) {
		git("push", "-q", "--force-with-lease", REMOTE, branch);
		log(`Pushed ${branch}.`);
	}
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
	const [command, name] = process.argv.slice(2);
	try {
		if (command === "new") newStack({ name });
		else if (command === "restack") await restack({});
		else if (command === "check") {
			const problem = branchNameProblem(name);
			if (problem) throw new Error(problem);
		} else throw new Error("Usage: pnpm stack <branch> | pnpm restack");
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
