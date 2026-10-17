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

describe("quoted strings that only read like an import", () => {
	it("ignores prose in an error message", () => {
		// The matcher looks for `from "..."`, which also appears inside ordinary strings. A gateway
		// error message saying `is served from "${serving}"` was read as an import of a package called
		// `${serving}` and failed the build (2026-10-17). A real specifier is a package name or a
		// path; nothing else is.
		const source =
			'throw new Error(`GATEWAY_APP_URL is served from "${serving}", so they differ`);';

		assert.deepEqual([...bundleImports(source)], []);
	});

	it("ignores anything with an interpolation in it, wherever it appears", () => {
		assert.deepEqual([...bundleImports('import("${name}")')], []);
		assert.deepEqual([...bundleImports('from "pkg-${version}"')], []);
	});

	it("ignores a quoted string that is not shaped like a package name", () => {
		assert.deepEqual([...bundleImports('from "hello there, friend"')], []);
		assert.deepEqual([...bundleImports('from ""')], []);
	});

	it("still finds the real ones beside the prose", () => {
		const source =
			'import x from "zod"; const m = `read from "somewhere else"`; import("@maschina/core");';

		assert.deepEqual([...bundleImports(source)].sort(), ["@maschina/core", "zod"]);
	});
});
