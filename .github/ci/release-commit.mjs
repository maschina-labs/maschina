#!/usr/bin/env node
/**
 * Put the release commit on its own branch, signed.
 *
 *   node .github/ci/release-commit.mjs 0.4.1
 *
 * Run after `prepare-release.mjs` has edited `CHANGELOG.md` and `package.json`
 * on disk. Creates the branch at the current HEAD, then commits the two edited
 * files onto it through GitHub's `createCommitOnBranch` mutation.
 *
 * **Why not `git commit && git push`.** The ruleset on main requires signed
 * commits, and a bot pushing over HTTPS signs nothing, so the release pull
 * request was mergeable by every check and blocked anyway. A commit created
 * through this mutation is signed by GitHub's own key.
 *
 * Dropping the signature requirement would have been the other way to fix it.
 * That trades a permanent weakening of every commit on main against a bot that
 * cannot sign, which is the wrong side of the trade.
 */

import { readFileSync } from "node:fs";

const version = process.argv[2];
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const branch = `release/v${version}`;

if (!version || !repository || !token) {
	console.error("Needs a version argument, GITHUB_REPOSITORY, and GH_TOKEN.");
	process.exit(1);
}

async function github(path, init = {}) {
	const response = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			accept: "application/vnd.github+json",
			"content-type": "application/json",
			...init.headers,
		},
	});
	const body = await response.json();
	return { ok: response.ok, status: response.status, body };
}

const headOid = process.env.GITHUB_SHA;
if (!headOid) {
	console.error("GITHUB_SHA is not set, so there is nothing to build the branch from.");
	process.exit(1);
}

// Start the branch from scratch every time.
//
// The first version force-moved an existing branch to HEAD and then committed
// onto it. For the instant between those two steps the branch was identical to
// main, GitHub auto-closed the open release pull request, and the guard that
// decides whether to open a new one read a state that was already stale and
// skipped. The release was built, signed, pushed, and nobody could see it.
//
// Deleting first makes it deterministic: any stale pull request is closed before
// anything else happens, and the caller can then rely on there being none.
const existing = await github(`/repos/${repository}/git/refs/heads/${branch}`);
if (existing.ok) {
	const deleted = await github(`/repos/${repository}/git/refs/heads/${branch}`, {
		method: "DELETE",
	});
	if (!deleted.ok && deleted.status !== 404) {
		console.error(`Could not clear ${branch}:`, deleted.body);
		process.exit(1);
	}
}

const created = await github(`/repos/${repository}/git/refs`, {
	method: "POST",
	body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: headOid }),
});
if (!created.ok) {
	console.error(`Could not create ${branch}:`, created.body);
	process.exit(1);
}

const file = (path) => ({ path, contents: readFileSync(path).toString("base64") });

const result = await github("/graphql", {
	method: "POST",
	body: JSON.stringify({
		query: `mutation ($input: CreateCommitOnBranchInput!) {
			createCommitOnBranch(input: $input) { commit { oid } }
		}`,
		variables: {
			input: {
				branch: { repositoryNameWithOwner: repository, branchName: branch },
				expectedHeadOid: headOid,
				message: { headline: `chore(release): ${version}` },
				fileChanges: { additions: [file("CHANGELOG.md"), file("package.json")] },
			},
		},
	}),
});

if (!result.ok || result.body.errors) {
	console.error(
		"createCommitOnBranch failed:",
		JSON.stringify(result.body.errors ?? result.body),
	);
	process.exit(1);
}

console.log(`${branch} at ${result.body.data.createCommitOnBranch.commit.oid}`);
