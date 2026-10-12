import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("no glint on any button", () => {
	it("is nowhere in the site's code: the sweeping light was taken out on purpose", () => {
		const here = dirname(fileURLToPath(import.meta.url));
		const files = readdirSync(here).filter(
			(name) => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name),
		);
		for (const name of files) {
			const code = readFileSync(resolve(here, name), "utf8");
			expect(code, name).not.toMatch(/data-glint|<Glint|from "\.\/glint/);
		}
		expect(files).not.toContain("glint.tsx");
	});
});
