import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("how the docs is served", () => {
	it("is a Worker of its own at docs.maschina.dev", () => {
		const config = read("wrangler.jsonc");
		expect(config).toMatch(/"name": "maschina-docs"/);
		expect(config).toContain(
			'"routes": [{ "pattern": "docs.maschina.dev", "custom_domain": true }]',
		);
		expect(config).toContain('"run_worker_first": ["/fonts/*"]');
	});

	it("is open to search, because documentation is meant to be found", () => {
		expect(read("public/robots.txt")).toMatch(/^Allow: \/$/m);
		expect(read("index.html")).not.toContain("noindex");
	});

	it("cannot be framed", () => {
		expect(read("public/_headers")).toContain("X-Frame-Options: DENY");
	});
});
