import { describe, expect, it } from "vitest";
import type { ArticleDoc } from "../article.tsx";
import { ROUTES } from "../routes.ts";
import { CONTACT } from "./contact.ts";

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

describe("the contact page", () => {
	it("writes the way the site does, seriously: no long dashes, no placeholders, no AI wording, no shouting, no first person", () => {
		const all = text(CONTACT);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|\bxxx\b|!/i);
		expect(all).not.toMatch(/\b(claude|chatgpt|openai|copilot|generated)\b/i);
		expect(all).not.toMatch(/\b(I|I'm|I've|my|me)\b/);
		expect(CONTACT.byline).toBe("Maschina Labs");
	});

	it("gives each kind of message its own role address, and never a person's", () => {
		const links = hrefs(CONTACT);
		for (const address of ["support", "billing", "security", "legal", "abuse"])
			expect(links, address).toContain(`mailto:${address}@maschina.dev`);
		const all = text(CONTACT);
		expect(all).not.toMatch(/\b(asher|info|ops|alerts|postmaster|platform)@/i);
		for (const href of links.filter((link) => link.startsWith("mailto:")))
			expect(href).toMatch(/^mailto:(support|billing|security|legal|abuse)@maschina\.dev$/);
	});

	it("sends a security problem to the disclosure page, promises no reply time except the one the security file already gives, and links only to real places", () => {
		expect(hrefs(CONTACT)).toContain("/disclosure");
		expect(text(CONTACT)).not.toMatch(
			/within (\d+|one|two|24|48) (hours?|days?)|same day|instant/i,
		);
		for (const href of hrefs(CONTACT))
			expect(
				href.startsWith("https://") || href.startsWith("mailto:") || href in ROUTES,
				href,
			).toBe(true);
	});
});
