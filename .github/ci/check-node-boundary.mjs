#!/usr/bin/env node
/**
 * The control plane and the node are separate processes. Nothing in the worker
 * may reach the database directly.
 *
 * `ADR-001` calls this the one piece of structure that is not negotiable, and
 * `06-NODES` open question 1 names the risk: build a system that only works when
 * the two are colocated, then discover at Stage 2 that the separation was never
 * real.
 *
 * The slice plan says to "watch for" a shared import. Watching is what we do
 * until we forget, so this checks instead. The worker talks HTTP or it talks to
 * nothing.
 */

import { readdirSync, readFileSync } from "node:fs";

/** Packages that must not reach the database, and what they may not import. */
const BOUNDARIES = [
	{
		package: "packages/worker",
		forbidden: [/@maschina\/db/, /\bfrom\s+["']pg["']/, /require\(["']pg["']\)/],
		why: "the worker runs on a node and reaches the control plane over HTTP. A node with a database connection is not a node, it is the control plane wearing a hat",
	},
	{
		package: "services/node",
		forbidden: [/@maschina\/db/, /\bfrom\s+["']pg["']/, /require\(["']pg["']\)/],
		why: "the node agent is the thing the boundary exists to bound. It is a daemon on somebody's machine, and the whole design depends on it having no way to reach the log except by asking",
	},
	{
		package: "apps/desktop",
		forbidden: [/@maschina\/db/, /\bfrom\s+["']pg["']/],
		why: "the desktop app reads the control plane's API. A renderer with database credentials is ambient authority",
	},
];

const problems = [];

function walk(dir, onFile) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name === "node_modules" || entry.name === "out" || entry.name === "dist")
			continue;
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walk(path, onFile);
		else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) onFile(path);
	}
}

for (const boundary of BOUNDARIES) {
	walk(boundary.package, (file) => {
		const source = readFileSync(file, "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, " ")
			.replace(/\/\/[^\n]*/g, " ");
		for (const pattern of boundary.forbidden) {
			if (pattern.test(source)) {
				problems.push(`${file}: ${pattern.source}\n    ${boundary.why}`);
			}
		}
	});

	// A dependency is as good as an import: if it is in package.json, someone
	// will eventually use it, and the boundary erodes without a diff that looks
	// like it crossed one.
	try {
		const manifest = JSON.parse(readFileSync(`${boundary.package}/package.json`, "utf8"));
		for (const field of ["dependencies", "devDependencies"]) {
			for (const name of Object.keys(manifest[field] ?? {})) {
				if (name === "pg" || name === "@maschina/db") {
					problems.push(
						`${boundary.package}/package.json: declares ${name} in ${field}\n    ${boundary.why}`,
					);
				}
			}
		}
	} catch {
		// No manifest. Nothing to check.
	}
}

if (problems.length > 0) {
	console.error(`Node boundary violated in ${problems.length} place(s):\n`);
	for (const problem of problems) console.error(`  ${problem}\n`);
	process.exit(1);
}

console.log(
	`Node boundary intact: ${BOUNDARIES.map((b) => b.package).join(", ")} cannot reach the database.`,
);
