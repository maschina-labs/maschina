import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse } from "yaml";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const labels = parse(read(".github/labels.yml"));
const names = labels.map((label) => label.name);
const dependabot = parse(read(".github/dependabot.yml"));

describe("labels", () => {
	it("are unique, coloured and described", () => {
		assert.equal(new Set(names).size, names.length);
		for (const label of labels) {
			assert.match(String(label.color), /^[0-9a-f]{6}$/, label.name);
			assert.ok(label.description?.length > 0 && label.description.length <= 100, label.name);
		}
	});

	it("rank every issue by priority and size", () => {
		for (const name of ["p0", "p1", "p2", "size: s", "size: m", "size: l"]) {
			assert.ok(names.includes(name), name);
		}
	});

	it("cover every part of the code", () => {
		for (const name of [
			"web",
			"api",
			"orchestrator",
			"signer",
			"daemon",
			"bots",
			"solana",
			"database",
		]) {
			assert.ok(names.includes(name), name);
		}
		for (const name of ["runtime", "sdk", "ui", "infra", "ai", "repo"]) {
			assert.ok(names.includes(name), name);
		}
	});

	it("include the ones release-please applies", () => {
		assert.ok(names.includes("autorelease: pending"));
		assert.ok(names.includes("autorelease: tagged"));
	});

	it("include every label Dependabot applies, so the sync never deletes them", () => {
		for (const update of dependabot.updates) {
			const applied = update.labels;
			assert.ok(applied?.length > 0, `${update["package-ecosystem"]} would create its own labels`);
			for (const name of applied) assert.ok(names.includes(name), name);
		}
	});
});
