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
	it("is set like a specification: a path-like label, a big plain title, when it was last updated, and the text", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const main = screen.getByRole("main");
		expect(within(main).getByRole("heading", { level: 1, name: "Example" })).toBeInTheDocument();
		// A label in the machine's own type, like a path.
		const label = within(main).getByText("legal / example");
		expect(label.className).toContain("font-mono");
		const updated = within(main).getByText("Last updated October 9, 2026");
		expect(updated.className).toContain("font-mono");
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});

	it("keeps the page margins on the article and the width on a box inside it, so the margins never squeeze the text", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const article = screen.getByRole("main").querySelector("article") as HTMLElement;
		expect(article.className).toContain("px-(--gutter)");
		expect(article.className).not.toMatch(/max-w-/);
		const column = article.firstElementChild as HTMLElement;
		expect(column).toHaveAttribute("data-column");
		expect(column.className).toContain("mx-auto");
		expect(column.className).toContain("max-w-[64rem]");
		expect(column.className).not.toContain("px-");
	});

	it("sets a heavier, tighter title and brighter text than before, and square bullets", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const title = screen.getByRole("heading", { level: 1 });
		for (const part of ["font-medium", "text-white", "tracking-[-0.04em]"])
			expect(title.className).toContain(part);
		expect(title.className).not.toMatch(/bg-clip-text|text-stroke|text-transparent/);
		const paragraph = screen.getByText("First paragraph.");
		expect(paragraph.className).toContain("text-neutral-200");
		expect(paragraph.className).toContain("leading-[1.7]");
		const list = screen.getByText("a").closest("ul") as HTMLElement;
		expect(list.className).toContain("list-[square]");
		expect(screen.getByRole("main").className).not.toMatch(/animate-/);
	});

	it("lays each section out in two columns on a wide screen: its number and heading on the left, held in view as it is read, and the text on the right", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const heading = screen.getByRole("heading", { level: 2, name: "One" });
		expect(heading).toHaveAttribute("id", "one");
		expect(heading.className).toContain("scroll-mt-28");
		const section = heading.closest("section") as HTMLElement;
		expect(section.className).toContain("md:grid-cols-[13rem_minmax(0,1fr)]");
		// A hairline above each, like a ruled table.
		expect(section.className).toContain("border-t");
		expect(section.className).toContain("border-white/10");
		const side = heading.parentElement as HTMLElement;
		expect(side.className).toContain("md:sticky");
		expect(side.className).toContain("md:top-28");
		const number = within(side).getByText("01");
		expect(number.className).toContain("font-mono");
		expect(number).toHaveAttribute("aria-hidden", "true");
		expect(screen.getByRole("heading", { level: 2, name: "Two" }).parentElement).toHaveTextContent(
			"02",
		);
	});

	it("lists the sections as an index in the machine's type, each a link to its section", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const toc = screen.getByRole("navigation", { name: "On this page" });
		const links = within(toc).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["01 One", "02 Two"]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["#one", "#two"]);
		expect(toc.className).toContain("font-mono");
		// Two columns that read down the first and then down the second, so 01 to 11 are on the left and 12 to 22 on the right.
		expect(within(toc).getByRole("list").className).toContain("sm:columns-2");
	});

	it("renders links and lists inside the text, with underlined links and plain bulleted lists", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const link = screen.getByRole("link", { name: "the privacy policy" });
		expect(link).toHaveAttribute("href", "/privacy");
		expect(link.className).toContain("underline");
		const list = screen.getByText("a").closest("ul") as HTMLElement;
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
		expect(hrefs).toContain("mailto:asher@maschina.dev");
	});

	it("sets out who runs it, where the law is, and how to reach them, in plain words", () => {
		const all = text(TERMS);
		expect(all).toMatch(/Maschina Labs/);
		expect(all).toMatch(/Alberta/);
		expect(all).toMatch(/asher@maschina\.dev/);
		expect(all).toMatch(/18/);
	});
});
