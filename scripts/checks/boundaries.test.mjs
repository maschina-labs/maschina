import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { checkBoundaries } from "./boundaries.mjs";

const roots = [];
after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Builds a throwaway repository from a map of path to file contents. */
function repo(files) {
	const root = mkdtempSync(join(tmpdir(), "maschina-boundaries-"));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		const full = join(root, path);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, typeof content === "string" ? content : JSON.stringify(content));
	}
	return root;
}

const pkg = (name, dependencies = {}) => ({ name, dependencies });

function rulesBroken(root) {
	return checkBoundaries(root).map((p) => p.rule.name);
}

describe("architecture boundaries", () => {
	it("passes a clean repository", () => {
		const root = repo({
			"packages/solana/package.json": pkg("@maschina/solana", { "@solana/kit": "1" }),
			"packages/solana/src/index.ts": 'import { address } from "@solana/kit";',
			"packages/core/package.json": pkg("@maschina/core"),
			"packages/core/src/index.ts": "export const x = 1;",
		});
		assert.deepEqual(checkBoundaries(root), []);
	});

	it("catches Solana imported outside packages/solana", () => {
		const root = repo({
			"services/gateway/package.json": pkg("@maschina/gateway"),
			"services/gateway/src/app.ts": 'import { address } from "@solana/kit";',
		});
		assert.deepEqual(rulesBroken(root), ["Only packages/solana talks to Solana"]);
	});

	it("catches Solana declared as a dependency outside packages/solana", () => {
		const root = repo({
			"apps/web/package.json": pkg("@maschina/web", { "@solana/kit": "1" }),
		});
		assert.deepEqual(rulesBroken(root), ["Only packages/solana talks to Solana"]);
	});

	it("catches a wallet provider SDK outside the signer", () => {
		const root = repo({
			"services/orchestrator/package.json": pkg("@maschina/orchestrator"),
			"services/orchestrator/src/main.ts": 'import { Turnkey } from "@turnkey/sdk-server";',
		});
		assert.deepEqual(rulesBroken(root), ["Only services/signer holds wallet provider SDKs"]);
	});

	it("allows a wallet provider SDK inside the signer", () => {
		const root = repo({
			"services/signer/package.json": pkg("@maschina/signer", { "@turnkey/sdk-server": "1" }),
			"services/signer/src/main.ts": 'import { Turnkey } from "@turnkey/sdk-server";',
		});
		assert.deepEqual(checkBoundaries(root), []);
	});

	it("catches the daemon reaching the database", () => {
		const root = repo({
			"services/daemon/package.json": pkg("@maschina/daemon"),
			"services/daemon/src/main.ts": 'import { db } from "@maschina/db";',
		});
		assert.deepEqual(rulesBroken(root), [
			"The daemon, runtime and clients never touch the database",
		]);
	});

	it("catches a dynamic import of a database driver", () => {
		const root = repo({
			"packages/runtime/package.json": pkg("@maschina/runtime"),
			"packages/runtime/src/index.ts": 'const pg = await import("postgres");',
		});
		assert.deepEqual(rulesBroken(root), [
			"The daemon, runtime and clients never touch the database",
		]);
	});

	it("catches side effects in a pure package", () => {
		const root = repo({
			"packages/rules/package.json": pkg("@maschina/rules"),
			"packages/rules/src/index.ts": 'import { readFileSync } from "node:fs";',
		});
		assert.deepEqual(rulesBroken(root), ["Core, rules and runtime have no side effects"]);
	});

	it("catches an app importing a service for real", () => {
		const root = repo({
			"apps/web/package.json": pkg("@maschina/web"),
			"apps/web/src/api.ts": 'import { app } from "@maschina/gateway";',
		});
		assert.deepEqual(rulesBroken(root), ["Apps never import services"]);
	});

	it("allows an app to import the gateway's types", () => {
		const root = repo({
			"apps/web/package.json": pkg("@maschina/web", { "@maschina/gateway": "workspace:*" }),
			"apps/web/src/api.ts": 'import type { AppType } from "@maschina/gateway";',
		});
		assert.deepEqual(checkBoundaries(root), []);
	});

	it("catches an import from a spike", () => {
		const root = repo({
			"packages/core/package.json": pkg("@maschina/core"),
			"packages/core/src/index.ts": 'export * from "../../../spikes/a0/wallet";',
		});
		assert.deepEqual(rulesBroken(root), ["Nothing imports a spike"]);
	});

	it("ignores node_modules and build output", () => {
		const root = repo({
			"services/daemon/package.json": pkg("@maschina/daemon"),
			"services/daemon/node_modules/x/index.js": 'require("postgres");',
			"services/daemon/dist/main.js": 'import "@maschina/db";',
		});
		assert.deepEqual(checkBoundaries(root), []);
	});
});
