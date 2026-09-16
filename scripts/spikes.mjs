#!/usr/bin/env node
/**
 * Type checks and tests every spike. Spikes are separate installs, outside the main workspace, so the
 * workspace's own checks never reach them.
 *
 * Usage: node scripts/spikes.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Every spike folder with a package.json, and anything that would make its checks unreliable. */
export function findSpikes(root) {
	const base = join(root, "spikes");
	if (!existsSync(base)) return { spikes: [], problems: [] };
	const spikes = [];
	const problems = [];
	for (const entry of readdirSync(base, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const dir = join(base, entry.name);
		const manifest = join(dir, "package.json");
		if (!existsSync(manifest)) continue;
		const scripts = JSON.parse(readFileSync(manifest, "utf8")).scripts ?? {};
		const missing = [
			!existsSync(join(dir, "pnpm-workspace.yaml")) &&
				"pnpm-workspace.yaml (without it the spike joins the main install)",
			!existsSync(join(dir, "pnpm-lock.yaml")) && "pnpm-lock.yaml",
			!scripts.test && "a test script",
			!scripts.typecheck && "a typecheck script",
		].filter(Boolean);
		for (const what of missing) problems.push(`spikes/${entry.name} is missing ${what}`);
		if (missing.length === 0) spikes.push({ name: entry.name, dir });
	}
	spikes.sort((a, b) => a.name.localeCompare(b.name));
	return { spikes, problems };
}

export function planSpikeChecks(spikes) {
	return spikes.flatMap(({ dir }) => [
		["pnpm", ["install", "--frozen-lockfile", "--dir", dir]],
		["pnpm", ["--dir", dir, "typecheck"]],
		["pnpm", ["--dir", dir, "test"]],
	]);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
	const root = join(fileURLToPath(import.meta.url), "../..");
	const { spikes, problems } = findSpikes(root);
	if (problems.length > 0) {
		console.error(problems.join("\n"));
		process.exit(1);
	}
	for (const [command, args] of planSpikeChecks(spikes)) {
		const { status } = spawnSync(command, args, { stdio: "inherit" });
		if (status !== 0) process.exit(status ?? 1);
	}
	console.log(
		spikes.length === 0 ? "No spikes." : `Checked ${spikes.map((s) => s.name).join(", ")}.`,
	);
}
