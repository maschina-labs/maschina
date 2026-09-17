import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { isolateGit } from "../test-support/isolated-git.mjs";
import { branchNameProblem, newStack, restack } from "./stack.mjs";

// Git commands here must act only on the repositories these tests create, even inside a git hook.
isolateGit();

describe("branchNameProblem", () => {
	it("accepts a type and one to three short words", () => {
		for (const name of [
			"feat/machine-list",
			"fix/login",
			"ci/fast-release-checks",
			"revert/a-b-c",
		]) {
			assert.equal(branchNameProblem(name), null, name);
		}
	});

	it("rejects anything else", () => {
		for (const name of [
			"main",
			"machine-list",
			"feature/machine-list",
			"feat/Machine-list",
			"feat/one-two-three-four",
			"feat/",
			"feat/machine_list",
			"feat/machine--list",
			"feat/a/b",
		]) {
			assert.match(branchNameProblem(name) ?? "", /should look like/, name);
		}
	});
});

/** A real clone with a real remote, so every git step runs for real. */
function workspace() {
	const root = mkdtempSync(join(tmpdir(), "maschina-stack-"));
	const origin = join(root, "origin.git");
	const repo = join(root, "repo");
	const run = (cwd, ...args) =>
		execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
		}).trim();

	run(root, "init", "-q", "--bare", "-b", "main", origin);
	run(root, "clone", "-q", origin, repo);
	const git = (...args) => run(repo, ...args);
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "Test");
	git("config", "commit.gpgsign", "false");

	const write = (file, content) => writeFileSync(join(repo, file), content);
	const read = (file) => readFileSync(join(repo, file), "utf8");
	const commit = (file, content, message) => {
		write(file, content);
		git("add", "-A");
		git("commit", "-q", "-m", message);
	};
	const subjects = (range) => git("log", "--format=%s", range).split("\n").filter(Boolean);

	commit("app.txt", "one\n", "first");
	git("push", "-q", "-u", "origin", "main");

	/** Squash merges a branch into main on the remote and deletes it, like GitHub does. */
	const squashMerge = (branch, title) => {
		git("switch", "-q", "main");
		git("merge", "-q", "--squash", branch);
		git("commit", "-q", "-m", title);
		git("push", "-q", "origin", "main");
		git("push", "-q", "origin", "--delete", branch);
	};

	return {
		root,
		repo,
		git,
		write,
		read,
		commit,
		subjects,
		squashMerge,
		env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
	};
}

describe("stacking", () => {
	const made = [];
	let ws;
	beforeEach(() => {
		ws = workspace();
		made.push(ws.root);
	});
	after(() => {
		for (const root of made) rmSync(root, { recursive: true, force: true });
	});

	const quiet = { log: () => {} };
	const merged = (names) => async (branch) => names.includes(branch);

	it("remembers which branch a stacked branch was built on", () => {
		const { git, commit } = ws;
		git("switch", "-q", "-c", "feat/first-part");
		commit("a.txt", "a\n", "a");
		newStack({ cwd: ws.repo, name: "feat/second-part", ...quiet });

		assert.equal(git("branch", "--show-current"), "feat/second-part");
		assert.equal(git("config", "branch.feat/second-part.stackparent"), "feat/first-part");
		assert.equal(
			git("config", "branch.feat/second-part.stackbase"),
			git("rev-parse", "feat/first-part"),
		);
	});

	it("refuses a bad name or an existing branch", () => {
		assert.throws(() => newStack({ cwd: ws.repo, name: "second", ...quiet }), /should look like/);
		ws.git("branch", "feat/taken");
		assert.throws(() => newStack({ cwd: ws.repo, name: "feat/taken", ...quiet }), /already exists/);
	});

	it("moves a stacked branch onto main after its parent is squash merged", async () => {
		const { git, commit, subjects, squashMerge, read } = ws;
		git("switch", "-q", "-c", "feat/first-part");
		commit("app.txt", "one\ntwo\n", "first part, step one");
		commit("app.txt", "one\ntwo\nthree\n", "first part, step two");
		git("push", "-q", "-u", "origin", "feat/first-part");

		newStack({ cwd: ws.repo, name: "feat/second-part", ...quiet });
		commit("app.txt", "one\ntwo\nthree\nfour\n", "second part");
		git("push", "-q", "-u", "origin", "feat/second-part");

		squashMerge("feat/first-part", "feat: first part");
		git("switch", "-q", "feat/second-part");

		await restack({ cwd: ws.repo, isMerged: merged(["feat/first-part"]), ...quiet });

		assert.deepEqual(subjects("origin/main..HEAD"), ["second part"]);
		assert.equal(git("merge-base", "HEAD", "origin/main"), git("rev-parse", "origin/main"));
		assert.equal(read("app.txt"), "one\ntwo\nthree\nfour\n");
		assert.equal(git("config", "branch.feat/second-part.stackparent"), "main");
		assert.equal(git("rev-parse", "HEAD"), git("rev-parse", "origin/feat/second-part"));
	});

	it("follows a parent that gained commits and isn't merged yet", async () => {
		const { git, commit, subjects } = ws;
		git("switch", "-q", "-c", "feat/first-part");
		commit("a.txt", "a\n", "first part");
		git("push", "-q", "-u", "origin", "feat/first-part");
		newStack({ cwd: ws.repo, name: "feat/second-part", ...quiet });
		commit("b.txt", "b\n", "second part");

		git("switch", "-q", "feat/first-part");
		commit("a.txt", "a, reviewed\n", "review fix");
		git("switch", "-q", "feat/second-part");

		await restack({ cwd: ws.repo, isMerged: merged([]), ...quiet });

		assert.deepEqual(subjects("feat/first-part..HEAD"), ["second part"]);
		assert.equal(git("merge-base", "HEAD", "feat/first-part"), git("rev-parse", "feat/first-part"));
		assert.equal(
			git("config", "branch.feat/second-part.stackbase"),
			git("rev-parse", "feat/first-part"),
		);
	});

	it("updates an ordinary branch onto the latest main", async () => {
		const { git, commit, subjects } = ws;
		git("switch", "-q", "-c", "fix/typo");
		commit("b.txt", "b\n", "typo");
		git("switch", "-q", "main");
		commit("c.txt", "c\n", "someone else's work");
		git("push", "-q", "origin", "main");
		git("reset", "-q", "--hard", "HEAD~1");
		git("switch", "-q", "fix/typo");

		await restack({ cwd: ws.repo, isMerged: merged([]), ...quiet });

		assert.deepEqual(subjects("origin/main..HEAD"), ["typo"]);
		assert.equal(git("merge-base", "HEAD", "origin/main"), git("rev-parse", "origin/main"));
	});

	it("stops when a parent is gone but was never merged", async () => {
		const { git, commit } = ws;
		git("switch", "-q", "-c", "feat/first-part");
		commit("a.txt", "a\n", "first part");
		git("push", "-q", "-u", "origin", "feat/first-part");
		newStack({ cwd: ws.repo, name: "feat/second-part", ...quiet });
		commit("b.txt", "b\n", "second part");
		git("push", "-q", "origin", "--delete", "feat/first-part");
		const before = git("rev-parse", "HEAD");

		await assert.rejects(
			restack({ cwd: ws.repo, isMerged: merged([]), ...quiet }),
			/was deleted without being merged/,
		);
		assert.equal(git("rev-parse", "HEAD"), before);
	});

	it("refuses to run on main or with uncommitted work", async () => {
		const { git, write } = ws;
		await assert.rejects(restack({ cwd: ws.repo, isMerged: merged([]), ...quiet }), /on main/);
		git("switch", "-q", "-c", "fix/typo");
		write("app.txt", "changed\n");
		await assert.rejects(restack({ cwd: ws.repo, isMerged: merged([]), ...quiet }), /uncommitted/);
	});

	it("leaves a conflict for you to resolve and can be run again after", async () => {
		const { git, commit, squashMerge, subjects } = ws;
		git("switch", "-q", "-c", "feat/first-part");
		commit("app.txt", "one\nfirst\n", "first part");
		git("push", "-q", "-u", "origin", "feat/first-part");
		newStack({ cwd: ws.repo, name: "feat/second-part", ...quiet });
		commit("app.txt", "one\nfirst\nsecond\n", "second part");

		git("switch", "-q", "feat/first-part");
		commit("app.txt", "one\nfirst, reworded\n", "review fix");
		git("push", "-q", "origin", "feat/first-part");
		squashMerge("feat/first-part", "feat: first part");
		git("switch", "-q", "feat/second-part");

		await assert.rejects(
			restack({ cwd: ws.repo, isMerged: merged(["feat/first-part"]), ...quiet }),
			/conflict/,
		);

		ws.write("app.txt", "one\nfirst, reworded\nsecond\n");
		git("add", "app.txt");
		execFileSync("git", ["-c", "core.editor=true", "rebase", "--continue"], {
			cwd: ws.repo,
			stdio: "ignore",
			env: { ...process.env, ...ws.env },
		});

		// The branch already knows its parent merged, so this run must not need to ask again.
		await restack({ cwd: ws.repo, isMerged: merged([]), ...quiet });
		assert.deepEqual(subjects("origin/main..HEAD"), ["second part"]);
	});
});
