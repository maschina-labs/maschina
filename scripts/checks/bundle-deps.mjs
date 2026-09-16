#!/usr/bin/env node
/**
 * Run inside a service after it builds. Every npm package the bundle imports must be one of the
 * service's own dependencies, or the deployed service fails at startup with a missing module.
 *
 * Usage (from a service directory): node ../../scripts/checks/bundle-deps.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SPECIFIER = /(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
const BUILTINS = new Set(builtinModules);

export function packageName(specifier) {
	if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
	return specifier.split("/")[0];
}

export function bundleImports(source) {
	const found = new Set();
	for (const match of source.matchAll(SPECIFIER)) {
		const specifier = match[1];
		if (!specifier || specifier.startsWith(".") || specifier.startsWith("/")) continue;
		if (specifier.startsWith("node:") || BUILTINS.has(specifier.split("/")[0])) continue;
		found.add(packageName(specifier));
	}
	return found;
}

export function missingDependencies(dir) {
	const dist = join(dir, "dist");
	if (!existsSync(dist)) throw new Error(`${dist} does not exist. Build first.`);
	const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
	const declared = new Set(Object.keys(manifest.dependencies ?? {}));
	const imported = new Set();
	for (const file of readdirSync(dist)) {
		if (!/\.m?js$/.test(file)) continue;
		for (const name of bundleImports(readFileSync(join(dist, file), "utf8"))) imported.add(name);
	}
	return [...imported].filter((name) => !declared.has(name)).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const missing = missingDependencies(process.cwd());
	if (missing.length > 0) {
		console.error(
			`The bundle imports packages this service doesn't depend on: ${missing.join(", ")}`,
		);
		console.error("Add them to dependencies in package.json.");
		process.exit(1);
	}
	console.log("Every package the bundle imports is a declared dependency.");
}
