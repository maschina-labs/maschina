import { describe, expect, it } from "vitest";
import type { ArticleDoc } from "../article.tsx";
import { ROUTES } from "../routes.ts";
import { HOW_IT_WORKS, MACHINES, PRODUCT, SECURITY } from "./product.ts";

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

const PAGES: [string, ArticleDoc][] = [
	["how it works", HOW_IT_WORKS],
	["machines", MACHINES],
	["product", PRODUCT],
	["security", SECURITY],
];

describe.each(PAGES)("the %s page", (_name, doc) => {
	it("writes the way the site does: no long dashes, no placeholders, no AI wording, no shouting", () => {
		const all = text(doc);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|\bxxx\b|!/i);
		expect(all).not.toMatch(/\b(claude|chatgpt|openai|copilot|generated)\b/i);
	});

	it("is written seriously, in the company's voice: no first person, no jokes, no hype", () => {
		const all = text(doc);
		expect(all).not.toMatch(/\b(I|I'm|I've|my|me)\b/);
		expect(all).not.toMatch(
			/\b(awesome|amazing|revolutionary|game.changing|magic|unlock|supercharge)\b/i,
		);
		expect(doc.byline).toBe("Maschina Labs");
	});

	it("claims nothing that is not true today: no returns, no figures, no audit, no guarantees", () => {
		const all = text(doc);
		expect(all).not.toMatch(/\d+%|\$\d|profit|returns of|earn |guarantee|risk.free|cannot lose/i);
		expect(all.replace(/not been independently audited/gi, "")).not.toMatch(/\baudited\b/i);
		expect(all).not.toMatch(/even if (our|the) servers/i);
		expect(all).not.toMatch(/only ever (pay|go|send)/i);
	});

	it("links only to pages that exist, or to the repository", () => {
		for (const href of hrefs(doc))
			expect(
				Boolean(ROUTES[href]) || href.startsWith("https://github.com/maschina-labs"),
				href,
			).toBe(true);
	});
});

describe("what these pages say about where Maschina stands", () => {
	it("the security page says what is built, and what is not, plainly", () => {
		const all = text(SECURITY);
		expect(all).toMatch(/not been independently audited/i);
		expect(all).toMatch(/still being built/i);
		expect(all).toMatch(/signer/i);
		expect(all).toMatch(/record/i);
		expect(hrefs(SECURITY)).toContain("/disclosure");
	});

	it("the product and how it works pages send a reader to the risks", () => {
		expect(hrefs(PRODUCT)).toContain("/risk");
		expect(hrefs(HOW_IT_WORKS)).toContain("/risk");
	});

	it("the machines page names the kinds that work today and says the rest are planned", () => {
		const all = text(MACHINES);
		for (const kind of [/recurring buy/i, /price trigger/i, /range/i]) expect(all).toMatch(kind);
		expect(all).toMatch(/planned/i);
	});

	it("says it is on paper first, with no real money, for how a machine is tried", () => {
		expect(text(HOW_IT_WORKS)).toMatch(/paper/i);
	});
});
