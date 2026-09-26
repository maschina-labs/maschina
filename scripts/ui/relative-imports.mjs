#!/usr/bin/env node
/**
 * Makes vendored component imports relative.
 *
 * The shadcn CLI writes imports the way its aliases are configured, which here comes out as
 * "src/shadcn/button": a path that only resolves from the repository root, not from an app that imports
 * this package. Run this after adding components:
 *
 *   node scripts/ui/relative-imports.mjs
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = new URL("../../packages/ui/src/", import.meta.url).pathname;

/** Every TypeScript file under a directory. */
function* files(dir) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) yield* files(path);
		else if (/\.tsx?$/.test(entry)) yield path;
	}
}

let changed = 0;
for (const file of files(root)) {
	const before = readFileSync(file, "utf8");
	const after = before.replace(/from "src\/([^"]+)"/g, (_whole, target) => {
		const to = join(root, target);
		let path = relative(dirname(file), to);
		if (!path.startsWith(".")) path = `./${path}`;
		// Everything in this repository imports with the extension.
		if (!/\.tsx?$/.test(path)) path += ".tsx";
		return `from "${path}"`;
	});
	if (after !== before) {
		writeFileSync(file, after);
		changed += 1;
	}
}

process.stdout.write(`${changed} file(s) made relative\n`);
