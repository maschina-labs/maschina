import { describe, expect, it } from "vitest";
import { ABOUT } from "../company/about.ts";
import { BRAND } from "../company/brand.ts";
import { PAPERS } from "../company/papers.ts";
import { SUPPORT } from "../company/support.ts";
import { TERMS } from "../legal/terms.ts";
import { en } from "./en.ts";
import { mapArticleDoc, mapBrand, mapLegal, mapPapers, mapStrings, mapSupport } from "./walk.ts";

const collect = <T>(map: (value: T, say: (text: string) => string) => T, value: T) => {
	const seen: string[] = [];
	map(value, (text) => {
		seen.push(text);
		return text;
	});
	return seen;
};

describe("walking a page's words", () => {
	it("visits every string of the catalog once, in a fixed order, and changes nothing when it says what it was given", () => {
		const seen = collect(mapStrings, en);
		expect(seen.length).toBeGreaterThan(200);
		expect(mapStrings(en, (text) => text)).toEqual(en);
		expect(collect(mapStrings, en)).toEqual(seen);
	});

	it("puts back what it is given, in the same order, leaving every address and every file where it was", () => {
		let n = 0;
		const shouted = mapLegal(TERMS, (text) => `${text.toUpperCase()}#${n++}`);
		expect(shouted.title).toBe(`${TERMS.title.toUpperCase()}#0`);
		expect(shouted.sections).toHaveLength(TERMS.sections.length);
		// Addresses are not words: they are never given to be said.
		const words = collect(mapLegal, TERMS).join("\n");
		expect(words).not.toMatch(/https?:\/\/|^\/terms$|mailto:/m);
		const links = (doc: typeof TERMS) =>
			doc.sections.flatMap((section) =>
				section.body.flatMap((block) =>
					Array.isArray(block)
						? block.flatMap((part) => (typeof part === "string" ? [] : [part.href]))
						: [],
				),
			);
		expect(links(shouted)).toEqual(links(TERMS));
	});

	it("keeps the names that are ids and the files that are paths out of the words, in the brand page", () => {
		const words = collect(mapBrand, BRAND);
		expect(words).not.toContain("wordmark");
		expect(words).not.toContain("/brand/maschina-brand-kit.zip");
		expect(words).not.toContain("#EAE5F4");
		expect(words).toContain("Pearl");
		expect(mapBrand(BRAND, (text) => text)).toEqual(BRAND);
	});

	it("is exact for the other pages too: nothing lost, nothing changed, nothing outside the words", () => {
		expect(mapSupport(SUPPORT, (text) => text)).toEqual(SUPPORT);
		expect(mapPapers(PAPERS, (text) => text)).toEqual(PAPERS);
		expect(mapArticleDoc(ABOUT, (text) => text)).toEqual(ABOUT);
		const support = collect(mapSupport, SUPPORT).join("\n");
		expect(support).not.toMatch(/\/contact|https:\/\/docs/);
		const papers = collect(mapPapers, PAPERS);
		expect(papers).toContain("Primer");
		expect(papers).not.toContain("papers");
	});
});
