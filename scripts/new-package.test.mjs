import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createWorkspace, planWorkspace } from "./new-package.mjs";

const dirs = [];
after(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
const tempRoot = () => {
	const dir = mkdtempSync(join(tmpdir(), "maschina-new-"));
	dirs.push(dir);
	return dir;
};

describe("new package", () => {
	it("lays out a library package", () => {
		const root = tempRoot();
		createWorkspace(root, "packages/pricing");
		const pkg = JSON.parse(readFileSync(join(root, "packages/pricing/package.json"), "utf8"));
		assert.equal(pkg.name, "@maschina/pricing");
		assert.deepEqual(pkg.exports, { ".": "./src/index.ts" });
		assert.equal(pkg.scripts.build, undefined);
		for (const file of [
			"tsconfig.json",
			"vitest.config.ts",
			"src/index.ts",
			"src/index.test.ts",
			"README.md",
		]) {
			assert.ok(existsSync(join(root, "packages/pricing", file)), file);
		}
	});

	it("lays out a service with a build and bundle check", () => {
		const plan = planWorkspace("services/scout");
		const pkg = JSON.parse(plan.files["package.json"]);
		assert.equal(pkg.scripts.build, "tsdown");
		assert.equal(pkg.scripts["check:bundle"], "node ../../scripts/checks/bundle-deps.mjs");
		assert.ok(plan.files["tsdown.config.ts"]);
		assert.ok(plan.files["src/main.ts"]);
	});

	it("refuses bad targets and names", () => {
		for (const bad of [
			undefined,
			"apps/web",
			"packages",
			"packages/Bad",
			"packages/a",
			"packages/x/y",
			"services/has_underscore",
		]) {
			assert.throws(() => planWorkspace(bad));
		}
	});

	it("never overwrites an existing workspace", () => {
		const root = tempRoot();
		createWorkspace(root, "packages/pricing");
		assert.throws(() => createWorkspace(root, "packages/pricing"), /already exists/);
	});
});
