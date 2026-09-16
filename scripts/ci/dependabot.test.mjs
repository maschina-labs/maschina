import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse } from "yaml";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const config = parse(read(".github/dependabot.yml"));
const ecosystem = (name) => {
	const entry = config.updates.find((update) => update["package-ecosystem"] === name);
	assert.ok(entry, `no ${name} entry`);
	return entry;
};
const holdsMajor = (entry, dependency) =>
	(entry.ignore ?? []).some(
		(rule) =>
			rule["dependency-name"] === dependency &&
			rule["update-types"]?.includes("version-update:semver-major"),
	);

describe("dependabot", () => {
	it("never proposes a new major version of Node or TypeScript", () => {
		assert.ok(holdsMajor(ecosystem("npm"), "@types/node"));
		assert.ok(holdsMajor(ecosystem("npm"), "typescript"));
		assert.ok(holdsMajor(ecosystem("docker"), "node"));
	});

	it("checks weekly on Mondays, one grouped pull request per group", () => {
		for (const update of config.updates) {
			const name = update["package-ecosystem"];
			assert.equal(update.schedule.interval, "weekly", name);
			assert.equal(update.schedule.day, "monday", name);
			assert.ok(update.groups && Object.keys(update.groups).length > 0, name);
			assert.ok(
				update["open-pull-requests-limit"] <= Object.keys(update.groups).length,
				`${name} can open more pull requests than it has groups`,
			);
		}
	});

	it("still proposes other major versions", () => {
		const npm = ecosystem("npm");
		assert.ok(!holdsMajor(npm, "*"));
		assert.deepEqual(npm.groups.major["update-types"], ["major"]);
	});

	it("waits as long as pnpm before proposing a new release", () => {
		const minutes = Number(read("pnpm-workspace.yaml").match(/^minimumReleaseAge:\s*(\d+)/m)?.[1]);
		assert.equal(ecosystem("npm").cooldown["default-days"] * 24 * 60, minutes);
	});

	it("watches every service image", () => {
		const services = ["gateway", "orchestrator", "signer", "daemon", "bots"];
		assert.deepEqual(
			ecosystem("docker").directories,
			services.map((service) => `/services/${service}`),
		);
	});

	it("titles its pull requests so the pull request checks accept them", () => {
		const pattern = read(".github/workflows/pr.yml").match(/grep -qE '([^']+)'/)?.[1];
		assert.ok(pattern);
		const titles = [
			"build(deps): bump the minor-and-patch group with 4 updates",
			"ci: bump the actions group with 2 updates",
			"build: bump the node-image group across 5 directories with 1 update",
		];
		for (const title of titles) assert.match(title, new RegExp(pattern), title);
		const prefixes = config.updates.map((update) => update["commit-message"].prefix);
		assert.deepEqual([...new Set(prefixes)].sort(), ["build", "ci"]);
	});
});
