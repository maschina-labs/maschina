import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { bundleImports, missingDependencies, packageName } from "./bundle-deps.mjs";

const dirs = [];
after(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function service(dependencies, bundle) {
	const dir = mkdtempSync(join(tmpdir(), "maschina-bundle-"));
	dirs.push(dir);
	mkdirSync(join(dir, "dist"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies }));
	writeFileSync(join(dir, "dist", "main.mjs"), bundle);
	return dir;
}

describe("bundle dependency check", () => {
	it("reduces specifiers to package names", () => {
		assert.equal(packageName("hono/cors"), "hono");
		assert.equal(packageName("@sentry/node/preload"), "@sentry/node");
	});

	it("ignores relative paths and Node built-ins", () => {
		const found = bundleImports(
			'import a from "./chunk.mjs"; import fs from "node:fs"; import path from "path"; import x from "pino";',
		);
		assert.deepEqual([...found], ["pino"]);
	});

	it("finds static, bare and dynamic imports", () => {
		const found = bundleImports(
			'import { a } from "hono";\nimport "zod";\nconst s = await import("@sentry/node");',
		);
		assert.deepEqual([...found].sort(), ["@sentry/node", "hono", "zod"]);
	});

	it("passes when every import is declared", () => {
		assert.deepEqual(
			missingDependencies(service({ hono: "1" }, 'import { Hono } from "hono";')),
			[],
		);
	});

	it("reports imports that aren't declared", () => {
		assert.deepEqual(
			missingDependencies(
				service({ hono: "1" }, 'import "hono"; import pino from "pino"; import("postgres");'),
			),
			["pino", "postgres"],
		);
	});

	it("refuses to check a service that hasn't been built", () => {
		const dir = mkdtempSync(join(tmpdir(), "maschina-bundle-"));
		dirs.push(dir);
		assert.throws(() => missingDependencies(dir), /Build first/);
	});
});
