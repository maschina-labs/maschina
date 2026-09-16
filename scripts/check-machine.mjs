#!/usr/bin/env node
/**
 * Checks that this machine can build and run Maschina, and says exactly what to fix when it can't.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const results = [];

function check(name, test) {
	try {
		const detail = test();
		results.push({ name, ok: true, detail });
	} catch (error) {
		results.push({
			name,
			ok: false,
			detail: error instanceof Error ? error.message : String(error),
		});
	}
}

const sh = (command) =>
	execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const required = JSON.parse(readFileSync("package.json", "utf8"));
const wantedNode = readFileSync(".nvmrc", "utf8").trim();
const wantedPnpm = required.packageManager.split("@")[1];

check("Node version", () => {
	const have = process.versions.node;
	if (have !== wantedNode) throw new Error(`have ${have}, need ${wantedNode}. Run: nvm use`);
	return have;
});

check("pnpm version", () => {
	const have = sh("pnpm --version");
	if (have !== wantedPnpm) throw new Error(`have ${have}, need ${wantedPnpm}`);
	return have;
});

check("Docker running", () => sh("docker info --format '{{.ServerVersion}}'"));

check("Postgres healthy", () => {
	const status = sh("docker inspect --format '{{.State.Health.Status}}' maschina-postgres");
	if (status !== "healthy") throw new Error(`container is ${status}. Run: pnpm docker:up`);
	return status;
});

check(".env present", () => {
	if (!existsSync(".env")) throw new Error("missing. Run: pnpm bootstrap");
	return "found";
});

check(".env has every variable", () => {
	const keys = (file) =>
		new Set(
			readFileSync(file, "utf8")
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"))
				.map((line) => line.split("=")[0]),
		);
	const expected = keys(".env.example");
	const actual = keys(".env");
	const missing = [...expected].filter((key) => !actual.has(key));
	if (missing.length > 0) throw new Error(`missing: ${missing.join(", ")}`);
	return `${expected.size} variables`;
});

check("Dependencies installed", () => {
	if (!existsSync("node_modules")) throw new Error("Run: pnpm install");
	return "found";
});

let failed = 0;
for (const r of results) {
	if (!r.ok) failed++;
	console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(26)} ${r.detail}`);
}

if (failed > 0) {
	console.log(`\n${failed} problem(s) to fix.`);
	process.exit(1);
}
console.log("\nEverything is set up.");
