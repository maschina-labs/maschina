import { describe, expect, it } from "vitest";
import { CONTENTS, contentFor } from "./content.ts";
import { LOCALES } from "./locales.ts";

type Block = string | { text: string; href: string }[] | { list: string[] } | { quote: string };

/** What a page is made of, apart from its words: how many sections, what kind of block each holds, where each link goes. */
function skeleton(doc: { sections: { body: Block[] }[] }) {
	return doc.sections.map((section) =>
		section.body.map((block) => {
			if (typeof block === "string") return "text";
			if (Array.isArray(block))
				return `parts:${block
					.filter((part) => typeof part !== "string")
					.map((part) => (part as { href: string }).href)
					.join(",")}`;
			if ("list" in block) return `list:${block.list.length}`;
			return "quote";
		}),
	);
}

describe("the pages of the site, by language", () => {
	const english = contentFor("en");

	it("has English, and gives a language with no pages the English ones, never a gap", () => {
		expect(CONTENTS["en"]).toBe(english);
		expect(contentFor("es")).toBe(english);
	});

	it("has every document, article and page that the site has", () => {
		expect(Object.keys(english.documents).sort()).toEqual([
			"/acceptable-use",
			"/disclosure",
			"/license",
			"/privacy",
			"/risk",
			"/terms",
		]);
		expect(Object.keys(english.articles).sort()).toEqual(["/about", "/roadmap"]);
		expect(english.support.ways).toHaveLength(4);
		expect(english.papers.groups).toHaveLength(4);
		expect(english.brand.logos.items).toHaveLength(3);
	});

	it("holds every language that has pages to the exact skeleton of English: the same sections, the same kinds of block, and every link going to the same place", () => {
		for (const locale of LOCALES) {
			const content = CONTENTS[locale.code];
			if (!content || locale.code === "en") continue;
			expect(Object.keys(content.documents).sort(), locale.code).toEqual(
				Object.keys(english.documents).sort(),
			);
			for (const path of Object.keys(english.documents))
				expect(skeleton(content.documents[path] as never), `${locale.code} ${path}`).toEqual(
					skeleton(english.documents[path] as never),
				);
			for (const path of Object.keys(english.articles))
				expect(skeleton(content.articles[path] as never), `${locale.code} ${path}`).toEqual(
					skeleton(english.articles[path] as never),
				);
			expect(
				content.support.ways.map((way) => way.href),
				locale.code,
			).toEqual(english.support.ways.map((way) => way.href));
			expect(
				content.papers.groups.map((group) => group.items.length),
				locale.code,
			).toEqual(english.papers.groups.map((group) => group.items.length));
			expect(
				content.brand.logos.items.map((item) => item.file),
				locale.code,
			).toEqual(english.brand.logos.items.map((item) => item.file));
		}
	});
});
