#!/usr/bin/env node
/**
 * No em dashes anywhere in the repo. Not in code, not in comments, not in docs.
 *
 * Use a colon after a short label, a comma inside a longer clause, or two
 * sentences when the halves are independent. A comma splice is not the fix. A
 * dash meaning "no value" in a table cell is a placeholder, so use a hyphen.
 *
 * This is a style rule, so it needs a machine to enforce it. A style rule that
 * depends on someone remembering is a style suggestion.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Built from its code point so the character itself never appears in this file.
// Otherwise the check fails on itself, which is a silly way to fail.
const EM_DASH = String.fromCharCode(0x2014);

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
	.split("\0")
	.filter(Boolean);

// internal/ is untracked, so `git ls-files` never sees it and CI never checks
// out. It drifted to 150 em dashes on that technicality. The rule is the whole
// repository, not the published part of it, so walk the directory too when it
// is on disk. CI has no internal/ and this adds nothing there.
function walk(dir) {
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...walk(path));
		else if (entry.isFile()) found.push(path);
	}
	return found;
}
if (existsSync("internal")) files.push(...walk("internal"));

const BINARY = /\.(png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|pdf|zip|lock)$/i;

const offenders = [];
for (const file of files) {
	if (BINARY.test(file)) continue;
	let text;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	if (!text.includes(EM_DASH)) continue;

	text.split("\n").forEach((line, index) => {
		if (line.includes(EM_DASH)) {
			offenders.push({ file, line: index + 1, text: line.trim() });
		}
	});
}

if (offenders.length > 0) {
	console.error(
		`Found ${offenders.length} em dash(es). Replace with a colon, a comma, or two sentences.\n`,
	);
	for (const { file, line, text } of offenders) {
		console.error(`  ${file}:${line}`);
		console.error(`    ${text.slice(0, 100)}`);
	}
	process.exit(1);
}

console.log(`No em dashes in ${files.length} files.`);
