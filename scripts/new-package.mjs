#!/usr/bin/env node
/**
 * Creates a workspace package or service with the same layout as every other one, so the repository
 * never drifts into a dozen slightly different shapes.
 *
 *   pnpm new:package packages/<name>
 *   pnpm new:package services/<name>
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const NAME = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;

export function planWorkspace(target) {
	const [group, name, ...rest] = String(target ?? "").split("/");
	if (!["packages", "services"].includes(group ?? "") || !name || rest.length > 0) {
		throw new Error("Usage: pnpm new:package packages/<name> or services/<name>");
	}
	if (!NAME.test(name)) {
		throw new Error(`"${name}" must be lowercase letters, numbers and dashes, 3 to 32 characters`);
	}
	const service = group === "services";
	const pkg = {
		name: `@maschina/${name}`,
		version: "0.0.0",
		private: true,
		type: "module",
		...(service ? {} : { exports: { ".": "./src/index.ts" } }),
		scripts: {
			...(service
				? {
						dev: "tsx watch --env-file-if-exists=../../.env src/main.ts",
						build: "tsdown",
						start: "node --enable-source-maps dist/main.mjs",
						"check:bundle": "node ../../scripts/checks/bundle-deps.mjs",
					}
				: {}),
			typecheck: "tsc --noEmit",
			test: "vitest run",
			"test:coverage": "vitest run --coverage",
		},
		devDependencies: {
			"@maschina/config": "workspace:*",
			"@types/node": "catalog:",
			"@vitest/coverage-v8": "catalog:",
			...(service ? { tsdown: "catalog:", tsx: "catalog:" } : {}),
			typescript: "catalog:",
			vitest: "catalog:",
		},
	};
	const entry = service ? "main" : "index";
	return {
		dir: `${group}/${name}`,
		files: {
			"package.json": `${JSON.stringify(pkg, null, "\t")}\n`,
			"tsconfig.json": `${JSON.stringify(
				{
					extends: "@maschina/config/tsconfig/node.json",
					include: service
						? ["src", "vitest.config.ts", "tsdown.config.ts"]
						: ["src", "vitest.config.ts"],
				},
				null,
				"\t",
			)}\n`,
			"vitest.config.ts": `import { vitestConfig } from "@maschina/config/vitest";\n\nexport default vitestConfig(${
				service ? '{ coverageExclude: ["src/main.ts"] }' : ""
			});\n`,
			...(service
				? {
						"tsdown.config.ts": `import { defineConfig } from "tsdown";\n\nexport default defineConfig({\n\tentry: ["src/main.ts"],\n\tformat: "esm",\n\tplatform: "node",\n\ttarget: "node24",\n\tsourcemap: true,\n\tclean: true,\n\tdeps: {\n\t\tneverBundle: true,\n\t\talwaysBundle: [/^@maschina\\//],\n\t},\n});\n`,
					}
				: {}),
			[`src/${entry}.ts`]: `// ${pkg.name}\n`,
			[`src/${entry}.test.ts`]: `import { describe, it } from "vitest";\n\ndescribe("${pkg.name}", () => {\n\tit.todo("does its first real thing");\n});\n`,
			"README.md": `# ${pkg.name}\n\nWhat this ${service ? "service" : "package"} is for, in one or two sentences.\n\n**Owns:** \n\n**Never:** \n`,
		},
	};
}

export function createWorkspace(root, target) {
	const plan = planWorkspace(target);
	const dir = join(root, plan.dir);
	if (existsSync(dir)) throw new Error(`${plan.dir} already exists`);
	for (const [file, content] of Object.entries(plan.files)) {
		const path = join(dir, file);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, content);
	}
	return plan;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		const plan = createWorkspace(process.cwd(), process.argv[2]);
		console.log(`Created ${plan.dir}. Fill in its README, then run pnpm install.`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
