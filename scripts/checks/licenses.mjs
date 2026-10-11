#!/usr/bin/env node
/**
 * Fails if a production dependency uses a licence we haven't approved.
 * Anything copyleft would constrain every future licensing decision for Maschina.
 */

import { execSync } from "node:child_process";

const ALLOWED = new Set([
	"MIT",
	"MIT-0",
	"ISC",
	"BSD-2-Clause",
	"BSD-3-Clause",
	"0BSD",
	"Apache-2.0",
	"BlueOak-1.0.0",
	"CC0-1.0",
	"CC-BY-4.0",
	"Unlicense",
	"Python-2.0",
	// The same licence, written out in words by one package.
	"MIT License",
]);

/**
 * Reviewed by hand, by name. MPL-2.0 is copyleft only for changes to its own files, and this one is an unmodified
 * build tool: it comes in through a test runner that the sign in library lists as an optional peer, and it never ships
 * in anything we publish. Any other MPL package still fails.
 */
const REVIEWED = new Map([
	["lightningcss", "MPL-2.0"],
	["lightningcss-darwin-arm64", "MPL-2.0"],
	["lightningcss-linux-x64-gnu", "MPL-2.0"],
	["lightningcss-linux-arm64-gnu", "MPL-2.0"],
]);

/** Handles SPDX expressions: any OR branch may be allowed, but every AND part must be. */
export function isAllowed(expression) {
	return expression
		.replace(/[()]/g, "")
		.split(/\s+OR\s+/)
		.some((branch) => branch.split(/\s+AND\s+/).every((part) => ALLOWED.has(part.trim())));
}

const report = JSON.parse(
	execSync("pnpm licenses list --prod --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
);

const problems = [];
for (const [licence, packages] of Object.entries(report)) {
	if (isAllowed(licence)) continue;
	for (const pkg of packages) {
		if (REVIEWED.get(pkg.name) === licence) continue;
		problems.push(`${pkg.name}@${pkg.versions.join(",")}  ${licence}`);
	}
}

if (problems.length > 0) {
	console.error(`${problems.length} dependency licence(s) need review:\n`);
	for (const p of problems) console.error(`  ${p}`);
	process.exit(1);
}
console.log("Every production dependency has an approved licence.");
