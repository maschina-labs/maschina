import { describe, expect, it } from "vitest";
import type { ArticleDoc } from "../article.tsx";
import { ROUTES } from "../routes.ts";
import { ABOUT } from "./about.ts";

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

describe("the about page", () => {
	it("writes the way the site does: no long dashes, no placeholders, no AI wording, no shouting", () => {
		const all = text(ABOUT);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|\bxxx\b|!/i);
		expect(all).not.toMatch(/\b(claude|chatgpt|openai|copilot|generated)\b/i);
	});

	it("claims nothing that is not true today: no users, no audit, no returns, no figures", () => {
		const all = text(ABOUT);
		expect(all).toMatch(/not been independently audited/i);
		expect(all).toMatch(/source-available, not open source/i);
		expect(all).not.toMatch(/\d+%|\$\d|users|customers|audited by|profit|returns of/i);
	});

	it("is written seriously, in the company's voice: no first person, no jokes, no chatty openers", () => {
		const all = text(ABOUT);
		expect(all).not.toMatch(/\b(I|I'm|I've|my|me)\b/);
		expect(all).not.toMatch(/\b(hope|cool|awesome|fun|magic|love)\b/i);
		expect(ABOUT.byline).toBe("Maschina Labs");
	});

	it("says who is behind it and where it started", () => {
		expect(text(ABOUT)).toMatch(/Asher Wilson/);
		expect(text(ABOUT)).toMatch(/September 16, 2026/);
		expect(text(ABOUT)).toMatch(/Maschina Labs/);
	});

	it("links only to pages that exist, or to the repository", () => {
		for (const href of hrefs(ABOUT))
			expect(href.startsWith("https://github.com/maschina-labs/") || href in ROUTES, href).toBe(
				true,
			);
	});
});
