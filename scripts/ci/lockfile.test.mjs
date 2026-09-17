import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse } from "yaml";

const lock = parse(readFileSync(new URL("../../pnpm-lock.yaml", import.meta.url), "utf8"));
const versionsOf = (name) =>
	Object.keys(lock.packages ?? {})
		.filter((key) => key.startsWith(`${name}@`))
		.map((key) => key.slice(name.length + 1).split("(")[0]);

const below = (version, floor) => {
	const [a, b, c] = version.split(".").map(Number);
	const [x, y, z] = floor.split(".").map(Number);
	return a - x || b - y || c - z;
};

describe("lockfile", () => {
	it("installs no esbuild with the development server advisory (below 0.25.0)", () => {
		const versions = versionsOf("esbuild");
		assert.ok(versions.length > 0, "esbuild not found in the lockfile");
		for (const version of versions) assert.ok(below(version, "0.25.0") >= 0, `esbuild ${version}`);
	});
});
