import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TERMS } from "./legal/terms.ts";
import { type LegalDoc, LegalPage } from "./legal.tsx";
import { ROUTES } from "./routes.ts";

const AUTH = "https://auth.maschina.dev";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});

const SMALL: LegalDoc = {
	title: "Example",
	updated: "October 9, 2026",
	intro: [
		"First paragraph.",
		["A link to ", { text: "the privacy policy", href: "/privacy" }, "."],
	],
	sections: [
		{ heading: "One", body: ["Text.", { list: ["a", "b"] }] },
		{ heading: "Two", body: ["More text."] },
	],
};

describe("a legal page", () => {
	it("is a plain centered column: one headline, when it was last updated, and the text", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const main = screen.getByRole("main");
		expect(within(main).getByRole("heading", { level: 1, name: "Example" })).toBeInTheDocument();
		expect(within(main).getByText("Last updated October 9, 2026")).toBeInTheDocument();
		const article = main.querySelector("article") as HTMLElement;
		// The page margins are the article's own padding, and the column sits inside them: if the narrow width and the
		// margins were on the same box, the margins would eat most of the column and squeeze the text into a sliver.
		expect(article.className).toContain("px-(--gutter)");
		expect(article.className).not.toMatch(/max-w-/);
		const column = article.firstElementChild as HTMLElement;
		expect(column).toHaveAttribute("data-column");
		// A centered measure of about eighty characters a line: wide enough not to feel squeezed, narrow enough to read.
		expect(column.className).toContain("mx-auto");
		expect(column.className).toContain("max-w-[44rem]");
		expect(column.className).not.toContain("px-");
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});

	it("sets the text for reading: roomy lines, a calm gray, and nothing fancy on the headline", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const paragraph = screen.getByText("First paragraph.");
		expect(paragraph.className).toContain("leading-[1.75]");
		expect(paragraph.className).toContain("text-neutral-300");
		expect(paragraph.className).toMatch(/text-\[1[67]px\]/);
		const title = screen.getByRole("heading", { level: 1 });
		// Plain white type: no gradient, no outline.
		expect(title.className).toContain("text-white");
		expect(title.className).not.toMatch(/bg-clip-text|text-stroke|text-transparent/);
		expect(screen.getByRole("main").className).not.toMatch(/animate-/);
	});

	it("numbers each section's heading and gives it an address, with a short list of them at the top to jump to", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const toc = screen.getByRole("navigation", { name: "On this page" });
		const links = within(toc).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["1. One", "2. Two"]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["#one", "#two"]);
		const heading = screen.getByRole("heading", { level: 2, name: "1. One" });
		expect(heading).toHaveAttribute("id", "one");
		expect(heading.className).toContain("scroll-mt-28");
	});

	it("renders links and lists inside the text, with underlined links and plain bulleted lists", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const link = screen.getByRole("link", { name: "the privacy policy" });
		expect(link).toHaveAttribute("href", "/privacy");
		expect(link.className).toContain("underline");
		const list = screen.getByText("a").closest("ul") as HTMLElement;
		expect(list.className).toContain("list-disc");
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["a", "b"]);
	});

	it("names the browser tab after the document", () => {
		document.title = "Maschina";
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		expect(document.title).toBe("Example · Maschina");
	});
});

describe("the terms of service", () => {
	const text = (doc: LegalDoc) =>
		[
			doc.title,
			...(doc.intro ?? []).map((p) =>
				typeof p === "string" ? p : p.map((x) => (typeof x === "string" ? x : x.text)).join(""),
			),
			...doc.sections.flatMap((s) => [
				s.heading,
				...s.body.flatMap((b) =>
					typeof b === "string"
						? [b]
						: Array.isArray(b)
							? [b.map((x) => (typeof x === "string" ? x : x.text)).join("")]
							: b.list,
				),
			]),
		].join("\n");

	it("covers what the terms of a service like this have to cover", () => {
		const headings = TERMS.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/who we are/i,
			/eligib|who can use/i,
			/wallet/i,
			/machines/i,
			/not (financial )?advice|financial advice/i,
			/risk/i,
			/fees/i,
			/third.party/i,
			/acceptable use|what you may not do/i,
			/intellectual property|our property/i,
			/termination|suspend/i,
			/disclaimer/i,
			/liability/i,
			/governing law|disputes/i,
			/changes/i,
			/contact/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("is dated, and only ever writes the way the site does: no dashes of any kind, no placeholders, no AI wording", () => {
		expect(TERMS.updated).toBe("October 9, 2026");
		const all = text(TERMS);
		// Neither of the long dashes, written as their codes so this file holds none itself.
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/\bTODO\b|\bTBD\b|\[[^\]]*\]|lorem|placeholder/i);
		expect(all).not.toMatch(
			/\bAI[- ]generated\b|written by an AI|ChatGPT|Claude|Anthropic's Claude/i,
		);
		expect(all).not.toMatch(/!/);
	});

	it("never promises a result, safety it cannot prove, or anything not built", () => {
		const all = text(TERMS);
		expect(all).not.toMatch(/guarantee(s|d)? (profit|returns|that you will)/i);
		// It may say the service has NOT been independently audited, which is true, and must never say it has been.
		expect(all.replace(/not been independently audited/gi, "")).not.toMatch(/\baudited\b/i);
		expect(all).not.toMatch(/\bfdic\b|insured|risk.free|cannot lose/i);
		expect(all).toMatch(/can lose (some or all|money)/i);
		expect(all).toMatch(/not financial advice|does not give financial advice|not .*adviser/i);
		expect(all).toMatch(/source.available/i);
		expect(all).not.toMatch(/open source license/i);
	});

	it("points to the other legal pages by their real addresses, and every internal link it makes is a page that exists", () => {
		const hrefs: string[] = [];
		const collect = (parts: (string | { text: string; href: string })[]) => {
			for (const part of parts) if (typeof part !== "string") hrefs.push(part.href);
		};
		for (const p of TERMS.intro ?? []) if (Array.isArray(p)) collect(p);
		for (const section of TERMS.sections)
			for (const block of section.body) if (Array.isArray(block)) collect(block);
		for (const href of ["/privacy", "/risk", "/license", "/disclosure"])
			expect(hrefs).toContain(href);
		for (const href of hrefs.filter((h) => h.startsWith("/")))
			expect(ROUTES[href], href).toBeDefined();
		expect(hrefs).toContain("mailto:info@maschina.dev");
	});

	it("sets out who runs it, where the law is, and how to reach them, in plain words", () => {
		const all = text(TERMS);
		expect(all).toMatch(/Maschina Labs/);
		expect(all).toMatch(/Alberta/);
		expect(all).toMatch(/info@maschina\.dev/);
		expect(all).toMatch(/18/);
	});
});
