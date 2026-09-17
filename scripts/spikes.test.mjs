import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { findSpikes, planSpikeAudits, planSpikeChecks } from "./spikes.mjs";

describe("findSpikes", () => {
	const root = mkdtempSync(join(tmpdir(), "maschina-spikes-"));
	after(() => rmSync(root, { recursive: true, force: true }));

	const spike = (name, files) => {
		mkdirSync(join(root, "spikes", name), { recursive: true });
		for (const [file, content] of Object.entries(files))
			writeFileSync(join(root, "spikes", name, file), content);
	};

	it("finds each spike with its own package and install", () => {
		spike("good", {
			"package.json": JSON.stringify({ scripts: { test: "x", typecheck: "y" } }),
			"pnpm-workspace.yaml": "minimumReleaseAge: 1440\n",
			"pnpm-lock.yaml": "",
		});
		mkdirSync(join(root, "spikes", "notes-only"), { recursive: true });
		writeFileSync(join(root, "spikes", "README.md"), "");

		const { spikes, problems } = findSpikes(root);
		assert.deepEqual(
			spikes.map((s) => s.name),
			["good"],
		);
		assert.deepEqual(problems, []);
	});

	it("reports a spike that would share the main install or skip its checks", () => {
		spike("shared", {
			"package.json": JSON.stringify({ scripts: { test: "x" } }),
			"pnpm-lock.yaml": "",
		});
		const { problems } = findSpikes(root);
		assert.ok(problems.some((p) => p.includes("shared") && p.includes("pnpm-workspace.yaml")));
		assert.ok(problems.some((p) => p.includes("shared") && p.includes("typecheck")));
	});

	it("reports a spike without a lockfile, because its install couldn't be reproduced", () => {
		spike("unlocked", {
			"package.json": JSON.stringify({ scripts: { test: "x", typecheck: "y" } }),
			"pnpm-workspace.yaml": "",
		});
		const { problems } = findSpikes(root);
		assert.ok(problems.some((p) => p.includes("unlocked") && p.includes("pnpm-lock.yaml")));
	});

	it("finds nothing when there is no spikes folder", () => {
		const empty = mkdtempSync(join(tmpdir(), "maschina-nospikes-"));
		try {
			assert.deepEqual(findSpikes(empty), { spikes: [], problems: [] });
		} finally {
			rmSync(empty, { recursive: true, force: true });
		}
	});
});

describe("planSpikeAudits", () => {
	it("audits each spike's dependencies for published advisories", () => {
		assert.deepEqual(planSpikeAudits([{ name: "a", dir: "/r/spikes/a" }]), [
			["pnpm", ["--dir", "/r/spikes/a", "audit", "--audit-level", "moderate"]],
		]);
	});
});

describe("planSpikeChecks", () => {
	it("installs exactly what the lockfile says, then type checks and tests", () => {
		assert.deepEqual(planSpikeChecks([{ name: "a", dir: "/r/spikes/a" }]), [
			["pnpm", ["install", "--frozen-lockfile", "--dir", "/r/spikes/a"]],
			["pnpm", ["--dir", "/r/spikes/a", "typecheck"]],
			["pnpm", ["--dir", "/r/spikes/a", "test"]],
		]);
	});
});
