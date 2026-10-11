import { describe, expect, it } from "vitest";
import { redirectFor } from "./redirect.ts";

const available = ["en", "es", "ar"] as const;

describe("when an address should send the visitor somewhere else", () => {
	it("sends a plain page to the language the visitor chose, and nowhere when they chose English or nothing", () => {
		expect(redirectFor("/terms", "", "", "es", available)).toBe("/es/terms");
		expect(redirectFor("/", "", "", "es", available)).toBe("/es");
		expect(redirectFor("/terms", "", "", "en", available)).toBeNull();
		expect(redirectFor("/terms", "", "", null, available)).toBeNull();
	});

	it("keeps the search and the fragment on the way", () => {
		expect(redirectFor("/contact", "?topic=billing", "#form", "es", available)).toBe(
			"/es/contact?topic=billing#form",
		);
	});

	it("never moves a visitor who asked for a language in the address: the address they asked for wins over what they chose before", () => {
		expect(redirectFor("/ar/terms", "", "", "es", available)).toBeNull();
		expect(redirectFor("/es/terms", "", "", "en", available)).toBeNull();
		expect(redirectFor("/es/terms", "", "", null, available)).toBeNull();
	});

	it("does not send a visitor to a language that is not ready, and takes one who asked for it back to English", () => {
		expect(redirectFor("/terms", "", "", "fr", available)).toBeNull();
		expect(redirectFor("/fr/terms", "", "", "es", available)).toBe("/terms");
		expect(redirectFor("/fr", "", "?a=1", null, available)).toBe("/?a=1");
	});

	it("leaves files alone: there is one of each, in no language", () => {
		for (const path of ["/llms.txt", "/SKILL.md", "/sitemap.xml", "/brand/kit/mark-white.svg"])
			expect(redirectFor(path, "", "", "es", available), path).toBeNull();
	});
});
