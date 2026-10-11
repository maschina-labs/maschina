import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

// The app lives at app.maschina.dev. maschina.dev is the company site, which is what search engines list.
describe("the app's files, now that it has its own address", () => {
	it("sends the sign up address the company site links to on to the sign in screen", () => {
		expect(read("public/_redirects")).toContain("/sign-up /sign-in 302");
	});

	it("keeps itself out of search and offers no sitemap, since the company site has them", () => {
		const robots = read("public/robots.txt");
		expect(robots).toMatch(/^Disallow: \/$/m);
		expect(robots).not.toContain("Sitemap:");
		expect(existsSync(resolve(root, "public/sitemap.xml"))).toBe(false);
	});

	it("names its own address and a preview image that is really there", () => {
		const html = read("index.html");
		expect(html).toContain('<meta property="og:url" content="https://app.maschina.dev" />');
		expect(html).toContain("https://app.maschina.dev/og/home.jpg");
		expect(html).not.toContain("https://maschina.dev/og/");
		expect(existsSync(resolve(root, "public/og/home.jpg"))).toBe(true);
	});

	it("tells an assistant where the app is", () => {
		expect(read("public/llms.txt")).toContain("- App: https://app.maschina.dev");
	});

	it("claims app.maschina.dev as a custom domain of its own Worker, and no other address", () => {
		const config = read("wrangler.jsonc");
		expect(config).toContain(
			'"routes": [{ "pattern": "app.maschina.dev", "custom_domain": true }]',
		);
		expect(config).not.toContain('"pattern": "maschina.dev"');
		expect(config).not.toContain("api.maschina.dev");
	});
});
