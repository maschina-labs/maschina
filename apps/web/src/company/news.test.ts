import { describe, expect, it } from "vitest";
import type { ArticleDoc } from "../article.tsx";
import { ROUTES } from "../routes.ts";
import { NEWS } from "./news.ts";

const text = (doc: ArticleDoc) =>
	[
		doc.title,
		doc.standfirst,
		...doc.sections.flatMap((section) => [
			section.heading ?? "",
			...section.body.flatMap((block) => {
				if (typeof block === "string") return [block];
				if (Array.isArray(block))
					return [block.map((part) => (typeof part === "string" ? part : part.text)).join("")];
				return "quote" in block ? [block.quote] : block.list;
			}),
		]),
	].join("\n");

const hrefs = (doc: ArticleDoc) =>
	doc.sections.flatMap((section) =>
		section.body.flatMap((block) =>
			Array.isArray(block)
				? block.flatMap((part) => (typeof part === "string" ? [] : [part.href]))
				: [],
		),
	);

describe("the news page", () => {
	it("writes the way the site does, seriously: no long dashes, no placeholders, no AI wording, no shouting, no first person", () => {
		const all = text(NEWS);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|\bxxx\b|!/i);
		expect(all).not.toMatch(/\b(claude|chatgpt|openai|copilot|generated)\b/i);
		expect(all).not.toMatch(/\b(I|I'm|I've|my|me)\b/);
		expect(NEWS.byline).toBe("Maschina Labs");
	});

	it("says honestly that there is nothing to announce yet, and invents no story, no date and no partner", () => {
		const all = text(NEWS);
		expect(all).toMatch(/nothing to announce yet/i);
		expect(all).not.toMatch(/\b(partner|partnership|raised|funding|launched|users|customers)\b/i);
		expect(all).not.toMatch(
			/\b(January|February|March|April|May|June|July|August|September|October|November|December) \d+, 20\d\d/,
		);
	});

	it("says where news will appear, and links only to real places", () => {
		const links = hrefs(NEWS);
		expect(links).toContain("https://x.com/maschinalabs");
		expect(links).toContain("https://github.com/maschina-labs/maschina");
		expect(links).toContain("/roadmap");
		for (const href of links)
			expect(href.startsWith("https://") || href in ROUTES, href).toBe(true);
	});
});
