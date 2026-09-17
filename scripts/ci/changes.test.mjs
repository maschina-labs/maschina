import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { isolateGit } from "../test-support/isolated-git.mjs";
import { classify, detectChanges, onlyVersionChanged } from "./changes.mjs";

// Git commands here must act only on the repositories these tests create, even inside a git hook.
isolateGit();

const EVERYTHING = { code: true, images: true };
const FULL_RUN = { ...EVERYTHING, affected: false };

describe("classify", () => {
	it("skips everything for a release pull request", () => {
		const files = ["CHANGELOG.md", ".release-please-manifest.json", "package.json"];
		assert.deepEqual(classify(files, { versionOnly: ["package.json"] }), {
			code: false,
			images: false,
		});
	});

	it("skips everything for docs and repository paperwork", () => {
		const files = [
			"README.md",
			"services/gateway/README.md",
			".github/ISSUE_TEMPLATE/bug.yml",
			".github/PULL_REQUEST_TEMPLATE.md",
			".github/CODEOWNERS",
			".github/labels.yml",
			".vscode/settings.json",
		];
		assert.deepEqual(classify(files), { code: false, images: false });
	});

	it("runs checks but not images for code no service ships", () => {
		for (const file of ["apps/web/src/main.tsx", "scripts/bootstrap.mjs", "biome.json"]) {
			assert.deepEqual(classify([file]), { code: true, images: false }, file);
		}
	});

	it("runs everything when a service or what it is built from changes", () => {
		for (const file of [
			"services/signer/src/app.ts",
			"packages/core/src/money.ts",
			"docker/postgres/init.sql",
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			".dockerignore",
			".nvmrc",
			".github/workflows/ci.yml",
			".github/actions/setup/action.yml",
		]) {
			assert.deepEqual(classify([file]), EVERYTHING, file);
		}
	});

	it("treats a root manifest change as code unless only the version moved", () => {
		assert.deepEqual(classify(["package.json"]), EVERYTHING);
		assert.deepEqual(classify(["package.json"], { versionOnly: ["package.json"] }), {
			code: false,
			images: false,
		});
	});

	it("runs everything when it can't tell what changed", () => {
		assert.deepEqual(classify(null), EVERYTHING);
		assert.deepEqual(classify([]), EVERYTHING);
	});
});

describe("onlyVersionChanged", () => {
	const manifest = (version, extra = {}) =>
		JSON.stringify({ name: "maschina", version, scripts: { test: "x" }, ...extra });

	it("is true when the version is the only difference", () => {
		assert.equal(onlyVersionChanged(manifest("0.0.1"), manifest("0.0.2")), true);
	});

	it("is false when anything else changed", () => {
		assert.equal(onlyVersionChanged(manifest("0.0.1"), manifest("0.0.2", { x: 1 })), false);
		assert.equal(onlyVersionChanged(manifest("0.0.1"), manifest("0.0.1", { x: 1 })), false);
	});

	it("is false when either side isn't valid JSON", () => {
		assert.equal(onlyVersionChanged("{", manifest("0.0.1")), false);
		assert.equal(onlyVersionChanged(manifest("0.0.1"), undefined), false);
	});
});

describe("detectChanges", () => {
	const dir = mkdtempSync(join(tmpdir(), "maschina-changes-"));
	after(() => rmSync(dir, { recursive: true, force: true }));

	const git = (...args) =>
		execFileSync("git", args, {
			cwd: dir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	const commit = (files, message) => {
		for (const [path, content] of Object.entries(files)) writeFileSync(join(dir, path), content);
		git("add", "-A");
		git("-c", "commit.gpgsign=false", "commit", "-q", "-m", message);
		return git("rev-parse", "HEAD");
	};

	git("init", "-q", "-b", "main");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "Test");
	const first = commit(
		{
			"package.json": JSON.stringify({ name: "x", version: "0.0.1" }),
			"CHANGELOG.md": "# Changelog\n",
			"app.ts": "export {};\n",
		},
		"first",
	);

	it("reads a real release commit as no code", () => {
		const release = commit(
			{
				"package.json": JSON.stringify({ name: "x", version: "0.0.2" }),
				"CHANGELOG.md": "# Changelog\n\n## 0.0.2\n",
			},
			"release",
		);
		assert.deepEqual(detectChanges({ base: first, head: release, cwd: dir }), {
			code: false,
			images: false,
			affected: true,
		});
	});

	it("reads a real code commit as code", () => {
		const base = git("rev-parse", "HEAD");
		const change = commit({ "app.ts": "export const x = 1;\n" }, "code");
		assert.deepEqual(detectChanges({ base, head: change, cwd: dir }), {
			code: true,
			images: false,
			affected: true,
		});
	});

	it("asks for a full run when the base is missing or unknown", () => {
		for (const base of [undefined, "", "0000000000000000000000000000000000000000", "deadbeef"]) {
			assert.deepEqual(detectChanges({ base, head: "HEAD", cwd: dir }), FULL_RUN, String(base));
		}
	});

	it("asks for a full run when nothing changed, such as a re-run", () => {
		assert.deepEqual(detectChanges({ base: "HEAD", head: "HEAD", cwd: dir }), FULL_RUN);
	});
});
