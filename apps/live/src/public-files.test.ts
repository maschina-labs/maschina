import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("how the live record is served", () => {
	it("keeps the old hostname attached to the redirect Worker", () => {
		const config = read("wrangler.jsonc");
		expect(config).toMatch(/"name": "maschina-live"/);
		expect(config).toContain(
			'"routes": [{ "pattern": "live.maschina.dev", "custom_domain": true }]',
		);
		expect(config).not.toContain('"assets"');
		expect(config).not.toContain('"r2_buckets"');
	});

	it("is open to search, because the record is meant to be found", () => {
		expect(read("public/robots.txt")).toMatch(/^Allow: \/$/m);
		expect(read("index.html")).not.toContain("noindex");
	});

	it("cannot be framed", () => {
		expect(read("public/_headers")).toContain("X-Frame-Options: DENY");
	});
});
