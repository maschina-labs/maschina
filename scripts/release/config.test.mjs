import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const config = JSON.parse(read("release-please-config.json"));
const manifest = JSON.parse(read(".release-please-manifest.json"));

describe("release config", () => {
	it("starts at 0.0.1, because release-please otherwise starts a project at 1.0.0", () => {
		assert.equal(config.packages["."]["initial-version"], "0.0.1");
	});

	it("bumps the patch on every release, leaving minor and major to milestones", () => {
		assert.equal(config.versioning, "always-bump-patch");
	});

	it("tags releases as v1.2.3", () => {
		assert.equal(config["include-v-in-tag"], true);
		assert.equal(config["include-component-in-tag"], false);
	});

	it("titles the release pull request so the pull request checks accept it", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: release-please's own placeholder, not a template.
		const title = config["pull-request-title-pattern"].replace("${version}", "0.0.1");
		const workflow = read(".github/workflows/pr.yml");
		const pattern = workflow.match(/grep -qE '([^']+)'/)?.[1];
		assert.ok(pattern, "pr.yml title pattern not found");
		assert.match(title, new RegExp(pattern));
		assert.ok(title.length <= 72);
	});

	it("tracks the one product package in the manifest", () => {
		assert.deepEqual(Object.keys(manifest), ["."]);
		assert.deepEqual(Object.keys(config.packages), ["."]);
	});
});
