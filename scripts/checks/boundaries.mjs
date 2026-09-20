#!/usr/bin/env node
/**
 * Architecture rules, checked on every commit and in CI.
 *
 * Each rule protects something the design depends on. A rule that only lives in a document gets
 * broken the first time it is inconvenient, so these fail the build instead.
 *
 * Usage: node scripts/checks/boundaries.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".turbo"]);

const DATABASE = ["@maschina/db", "postgres", "pg", "drizzle-orm"];
const SOLANA = [/^@solana\//, /^@solana-program\//];
const WALLET_PROVIDERS = [/^@turnkey\//, /^@crossmint\//, /^@privy-io\//];
const SIDE_EFFECTS = [
	"fs",
	"net",
	"http",
	"https",
	"child_process",
	"node:fs",
	"node:fs/promises",
	"node:net",
	"node:http",
	"node:https",
	"node:child_process",
	"node:dgram",
];

/**
 * Each rule names the workspaces it applies to and what they may not import.
 * `allowTypeOnly` permits `import type`, which disappears at build time.
 */
export const RULES = [
	{
		name: "Only packages/solana talks to Solana",
		why: "Everything chain-specific stays behind one boundary so the rest never depends on it.",
		appliesTo: (ws) => ws !== "packages/solana",
		forbidden: SOLANA,
	},
	{
		name: "Only packages/wallet and the two services that use it hold wallet provider SDKs",
		why: "One place knows how a provider works: the signer signs with a key that can do nothing else, and the provisioner creates wallets with the admin key. Nothing else goes near them.",
		appliesTo: (ws) => !["packages/wallet", "services/signer", "services/provisioner"].includes(ws),
		forbidden: WALLET_PROVIDERS,
	},
	{
		name: "The daemon, runtime and clients never touch the database",
		why: "A daemon may run on someone else's computer. It asks the orchestrator for everything.",
		appliesTo: (ws) =>
			[
				"services/daemon",
				"services/bots",
				"apps/web",
				"packages/core",
				"packages/rules",
				"packages/runtime",
				"packages/sdk",
				"packages/contracts",
				"packages/ui",
			].includes(ws),
		forbidden: DATABASE,
	},
	{
		name: "Core, rules and runtime have no side effects",
		why: "They are pure, so they can be tested exhaustively and run anywhere.",
		appliesTo: (ws) => ["packages/core", "packages/rules", "packages/runtime"].includes(ws),
		forbidden: SIDE_EFFECTS,
	},
	{
		name: "Apps never import services",
		why: "Apps reach services over the network. A type import of the gateway is allowed for the typed client.",
		appliesTo: (ws) => ws.startsWith("apps/"),
		forbidden: [/^@maschina\/(gateway|orchestrator|signer|daemon|bots)$/],
		allowTypeOnly: ["@maschina/gateway"],
	},
	{
		name: "Nothing imports a spike",
		why: "Spikes are throwaway. Real code never depends on them.",
		appliesTo: () => true,
		forbidden: [/(^|\/)spikes\//],
	},
];

const IMPORT_PATTERNS = [
	/^\s*import\s+(type\s+)?[^'"]*?from\s+["']([^"']+)["']/,
	/^\s*import\s+["']([^"']+)["']/,
	/^\s*export\s+(type\s+)?[^'"]*?from\s+["']([^"']+)["']/,
	/\bimport\(\s*["']([^"']+)["']\s*\)/,
	/\brequire\(\s*["']([^"']+)["']\s*\)/,
];

function matches(specifier, patterns) {
	return patterns.some((p) =>
		typeof p === "string" ? specifier === p || specifier.startsWith(`${p}/`) : p.test(specifier),
	);
}

function parseImports(line) {
	for (const pattern of IMPORT_PATTERNS) {
		const m = line.match(pattern);
		if (!m) continue;
		if (m.length === 3) return { specifier: m[2], typeOnly: Boolean(m[1]) };
		return { specifier: m[1], typeOnly: false };
	}
	return null;
}

function walk(dir, files = []) {
	if (!existsSync(dir)) return files;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path, files);
		else if (SOURCE_FILE.test(entry.name)) files.push(path);
	}
	return files;
}

export function listWorkspaces(root) {
	const found = [];
	for (const group of ["apps", "services", "packages"]) {
		const dir = join(root, group);
		if (!existsSync(dir)) continue;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory() && existsSync(join(dir, entry.name, "package.json"))) {
				found.push(`${group}/${entry.name}`);
			}
		}
	}
	return found;
}

/**
 * Writing to the permanent record goes through one function, which checks the payload against its
 * contract and refuses a stale lease. A direct insert anywhere else would skip both. Tests may insert
 * directly: that is how the database's own rules are proved.
 */
const RECORD_WRITE = /insert\s+into\s+"?events"?|\.insert\(\s*(schema\.)?events\b/i;
const RECORD_WRITER = "packages/db/src/record.ts";
const TEST_FILE = /\.test\.[a-z]+$/;

export function checkRecordWrites(root) {
	const rule = {
		name: "Only the record writer appends events",
		why: "appendEvent checks the payload and the lease epoch. A direct insert skips both.",
	};
	const problems = [];
	for (const ws of listWorkspaces(root)) {
		for (const file of walk(join(root, ws))) {
			const where = relative(root, file);
			if (where === RECORD_WRITER || TEST_FILE.test(where)) continue;
			readFileSync(file, "utf8")
				.split("\n")
				.forEach((line, index) => {
					if (RECORD_WRITE.test(line)) {
						problems.push({ rule, where: `${where}:${index + 1}`, what: "an insert into events" });
					}
				});
		}
	}
	return problems;
}

/**
 * The web app reaches `@maschina/core` through `@maschina/env`, so anything that barrel re-exports ends
 * up in the browser. A node builtin there is not a warning: the bundler replaces it with a module that
 * throws the moment anything touches it, and the page renders blank with no failing test to show for it
 * (`internal/MISTAKES.md` M14). Content addressing needs `node:crypto`, so it lives behind a subpath
 * that only server code imports.
 */
const BROWSER_ENTRY = "packages/core/src/index.ts";

export function checkBrowserSafety(root) {
	const rule = {
		name: "The browser-facing entry pulls in no node builtins",
		why: "A node builtin reaching the browser is a blank page, not an error message.",
	};
	const problems = [];
	const entryPath = join(root, BROWSER_ENTRY);
	if (!existsSync(entryPath)) return problems;

	const entry = readFileSync(entryPath, "utf8");
	const files = [[BROWSER_ENTRY, entry]];
	for (const match of entry.matchAll(/from "\.\/([\w-]+)\.ts"/g)) {
		const where = `packages/core/src/${match[1]}.ts`;
		const full = join(root, `packages/core/src/${match[1]}.ts`);
		if (existsSync(full)) files.push([where, readFileSync(full, "utf8")]);
	}

	for (const [where, source] of files) {
		source.split("\n").forEach((line, index) => {
			const found = /from "(node:[\w/]+)"/.exec(line);
			if (found) {
				problems.push({
					rule,
					where: `${where}:${index + 1}`,
					what: `${found[1]}, reachable from the browser`,
				});
			}
		});
	}
	return problems;
}

/**
 * Machine kinds are data, not branches. The runtime runs every kind through one interface, so naming a
 * kind outside its own module means the core has started to care which kind it is, and adding a kind
 * would mean editing the loop. Each kind's module, and tests, may name it.
 */
const KIND_NAMES = /["'`](recurring_buy|take_profit|rebalance|price_trigger|sniper)["'`]/;
const KINDS_DIR = "packages/runtime/src/kinds/";

export function checkKindNames(root) {
	const rule = {
		name: "Only a machine kind's own module names that kind",
		why: "Every kind runs through one interface. Naming a kind elsewhere is the core branching on it.",
	};
	const problems = [];
	for (const ws of listWorkspaces(root)) {
		for (const file of walk(join(root, ws))) {
			const where = relative(root, file);
			if (where.startsWith(KINDS_DIR) || TEST_FILE.test(where)) continue;
			readFileSync(file, "utf8")
				.split("\n")
				.forEach((line, index) => {
					const found = line.match(KIND_NAMES);
					if (found) problems.push({ rule, where: `${where}:${index + 1}`, what: found[1] });
				});
		}
	}
	return problems;
}

export function checkBoundaries(root) {
	const problems = [];

	for (const ws of listWorkspaces(root)) {
		const rules = RULES.filter((r) => r.appliesTo(ws));
		if (rules.length === 0) continue;

		const manifest = JSON.parse(readFileSync(join(root, ws, "package.json"), "utf8"));
		const declared = Object.keys({
			...manifest.dependencies,
			...manifest.devDependencies,
			...manifest.peerDependencies,
			...manifest.optionalDependencies,
		});

		for (const rule of rules) {
			for (const dep of declared) {
				if (matches(dep, rule.forbidden) && !rule.allowTypeOnly?.includes(dep)) {
					problems.push({ rule, where: `${ws}/package.json`, what: dep });
				}
			}
		}

		for (const file of walk(join(root, ws))) {
			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((line, index) => {
				const found = parseImports(line);
				if (!found) return;
				for (const rule of rules) {
					if (!matches(found.specifier, rule.forbidden)) continue;
					if (found.typeOnly && rule.allowTypeOnly?.includes(found.specifier)) continue;
					problems.push({
						rule,
						where: `${relative(root, file)}:${index + 1}`,
						what: found.specifier,
					});
				}
			});
		}
	}

	return problems;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
	const root = join(fileURLToPath(import.meta.url), "../../..");
	const problems = [
		...checkBoundaries(root),
		...checkRecordWrites(root),
		...checkBrowserSafety(root),
		...checkKindNames(root),
	];
	if (problems.length === 0) {
		console.log("Architecture boundaries hold.");
		process.exit(0);
	}
	console.error(`${problems.length} architecture rule violation(s):\n`);
	for (const p of problems) {
		console.error(`  ${p.where}  has ${p.what}`);
		console.error(`    ${p.rule.name}. ${p.rule.why}\n`);
	}
	process.exit(1);
}
