import { describe, expect, it } from "vitest";
import type { ArticleDoc } from "../article.tsx";
import { ROUTES } from "../routes.ts";
import { ROADMAP } from "./roadmap.ts";

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

describe("the roadmap", () => {
	it("writes the way the site does, seriously: no long dashes, no placeholders, no AI wording, no shouting, no first person", () => {
		const all = text(ROADMAP);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|\bxxx\b|!/i);
		expect(all).not.toMatch(/\b(claude|chatgpt|openai|copilot|generated)\b/i);
		expect(all).not.toMatch(/\b(I|I'm|I've|my|me)\b/);
		expect(ROADMAP.byline).toBe("Maschina Labs");
	});

	it("is ordered Now, Next, Later, each with a list of things", () => {
		const headings = ROADMAP.sections.map((section) => section.heading);
		expect(headings).toEqual(expect.arrayContaining(["Now", "Next", "Later"]));
		expect(headings.indexOf("Now")).toBeLessThan(headings.indexOf("Next"));
		expect(headings.indexOf("Next")).toBeLessThan(headings.indexOf("Later"));
		for (const name of ["Now", "Next", "Later"]) {
			const section = ROADMAP.sections.find((entry) => entry.heading === name);
			const items = (section?.body ?? []).flatMap((block) =>
				typeof block === "object" && !Array.isArray(block) && "list" in block ? block.list : [],
			);
			expect(items.length, name).toBeGreaterThan(2);
		}
	});

	it("promises no dates and no outcomes, and says plans change and an audit is not scheduled", () => {
		const all = text(ROADMAP);
		expect(all).not.toMatch(
			/\b(Q[1-4]|January|February|March|April|May|June|July|August|September|November|December)\b(?! \d+, 2026)/,
		);
		expect(all).not.toMatch(
			/\b20(2[7-9]|3\d)\b|by (the )?end of|will launch|guarantee|profit|\d+%/i,
		);
		expect(all).toMatch(/plans change/i);
		expect(all).toMatch(/no date/i);
		expect(all).not.toMatch(/audit (is )?(scheduled|booked|complete)/i);
	});

	it("links only to pages that exist, or to the repository", () => {
		for (const href of hrefs(ROADMAP))
			expect(href.startsWith("https://github.com/maschina-labs/") || href in ROUTES, href).toBe(
				true,
			);
	});
});
