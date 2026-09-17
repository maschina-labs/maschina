import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isolateGit } from "./isolated-git.mjs";

isolateGit();

const root = fileURLToPath(new URL("../..", import.meta.url));
const GIT_TESTS = ["scripts/git/stack.test.mjs", "scripts/ci/changes.test.mjs"];

describe("tests that run git", () => {
	const decoy = mkdtempSync(join(tmpdir(), "maschina-decoy-"));
	after(() => rmSync(decoy, { recursive: true, force: true }));

	const git = (...args) => execFileSync("git", args, { cwd: decoy, encoding: "utf8" }).trim();
	git("init", "-q", "-b", "main");
	git("config", "user.name", "Decoy");
	git("config", "user.email", "decoy@example.com");
	writeFileSync(join(decoy, "keep.txt"), "keep\n");
	git("add", "keep.txt");
	git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "decoy");

	const snapshot = () => ({
		config: readFileSync(join(decoy, ".git", "config"), "utf8"),
		refs: git("for-each-ref", "--format=%(refname) %(objectname)"),
		head: git("symbolic-ref", "HEAD"),
		status: git("status", "--porcelain"),
		file: readFileSync(join(decoy, "keep.txt"), "utf8"),
	});

	it("leave a repository alone even when a git hook points git at it", () => {
		const before = snapshot();
		// What git sets for a pre-push hook in a second worktree: where the repository and its index are.
		const hookEnv = {
			...process.env,
			GIT_DIR: join(decoy, ".git"),
			GIT_INDEX_FILE: join(decoy, ".git", "index"),
		};
		// Otherwise the nested run thinks it is part of this one and doesn't really run the files.
		delete hookEnv.NODE_TEST_CONTEXT;
		const result = spawnSync(process.execPath, ["--test", ...GIT_TESTS], {
			cwd: root,
			env: hookEnv,
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stdout.slice(-2000));
		assert.deepEqual(snapshot(), before);
	});
});
