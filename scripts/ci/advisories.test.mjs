import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const read = (path) => parse(readFileSync(new URL(path, root), "utf8"));

/** Every advisory pnpm is told to ignore, in the main workspace and every spike. */
function ignoredByPnpm() {
	const files = ["pnpm-workspace.yaml"];
	for (const entry of readdirSync(new URL("spikes/", root), { withFileTypes: true })) {
		const file = `spikes/${entry.name}/pnpm-workspace.yaml`;
		if (entry.isDirectory() && existsSync(new URL(file, root))) files.push(file);
	}
	return new Set(files.flatMap((file) => read(file)?.auditConfig?.ignoreGhsas ?? []));
}

function allowedInCi() {
	const workflow = read(".github/workflows/dependency-review.yml");
	const step = workflow.jobs.review.steps.find((s) =>
		String(s.uses).includes("dependency-review-action"),
	);
	return new Set(
		String(step.with["allow-ghsas"] ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean),
	);
}

describe("ignored advisories", () => {
	it("are the same for local audits and CI's dependency review", () => {
		assert.deepEqual([...allowedInCi()].sort(), [...ignoredByPnpm()].sort());
	});

	it("allow only licences the product itself never ships", () => {
		const workflow = read(".github/workflows/dependency-review.yml");
		const step = workflow.jobs.review.steps.find((s) =>
			String(s.uses).includes("dependency-review-action"),
		);
		const allowed = String(step.with["allow-dependencies-licenses"] ?? "")
			.split(",")
			.map((p) => p.trim())
			.filter(Boolean);
		assert.deepEqual(allowed, ["pkg:npm/rpc-websockets"]);
	});

	it("are real advisory ids", () => {
		for (const id of ignoredByPnpm()) assert.match(id, /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/, id);
	});
});
