import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("the docs tab", () => {
	it("is named Docs, in Title Case, after the site's own pattern of the page then Maschina", () => {
		const html = readFileSync(
			resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"),
			"utf8",
		);
		expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe("Docs | Maschina");
	});
});
