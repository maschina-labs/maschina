import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("how the sign in app is served", () => {
	it("is a Worker of its own at auth.maschina.dev, with the fonts from the private bucket and every other address left to the app", () => {
		const config = read("wrangler.jsonc");
		expect(config).toMatch(/"name": "maschina-auth"/);
		expect(config).toContain(
			'"routes": [{ "pattern": "auth.maschina.dev", "custom_domain": true }]',
		);
		expect(config).toContain('"not_found_handling": "single-page-application"');
		expect(config).toContain('"run_worker_first": ["/fonts/*"]');
		expect(config).toContain('"bucket_name": "maschina-fonts"');
	});

	it("keeps itself out of search, because a sign in screen is not a page to find", () => {
		expect(read("public/robots.txt")).toMatch(/^Disallow: \/$/m);
		expect(read("index.html")).toContain('<meta name="robots" content="noindex, nofollow" />');
	});

	it("cannot be framed, because a login screen inside somebody else's page is how a login is stolen", () => {
		const headers = read("public/_headers");
		expect(headers).toContain("X-Frame-Options: DENY");
		expect(headers).toContain("X-Content-Type-Options: nosniff");
		expect(headers).toContain("Strict-Transport-Security");
		expect(headers).toContain("Referrer-Policy: no-referrer");
	});

	it("has the wordmark it draws", () => {
		expect(existsSync(resolve(root, "public/brand/wordmark.svg"))).toBe(true);
	});
});
