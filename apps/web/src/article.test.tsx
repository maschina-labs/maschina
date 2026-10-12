import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ArticleDoc, ArticlePage } from "./article.tsx";

const AUTH = "https://auth.maschina.dev";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => vi.unstubAllGlobals());

const DOC: ArticleDoc = {
	kicker: "Company",
	title: "A plain headline",
	standfirst: "One sentence that says what this is.",
	byline: "Asher Wilson",
	date: "October 9, 2026",
	sections: [
		{
			heading: "First",
			body: [
				"Alpha.",
				["See ", { text: "the terms", href: "/terms" }, "."],
				{ quote: "A line worth pulling out." },
				{ list: ["a", "b"] },
			],
		},
		{ body: ["No heading here."] },
	],
};

describe("an article page", () => {
	it("opens like a newsletter: a big centered headline, a standfirst, and who wrote it and when", () => {
		const { container } = render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A plain headline");
		const head = container.querySelector("[data-head]") as HTMLElement;
		// Everything in the head is centered, as one block, in the middle of the page.
		const inner = container.querySelector("[data-head-text]") as HTMLElement;
		expect(inner.className).toContain("max-w-[48rem]");
		expect(inner.className).toContain("mx-auto");
		expect(inner.className).toContain("text-center");
		expect(head).toHaveTextContent("One sentence that says what this is.");
		expect(head).toHaveTextContent("By Asher Wilson");
		const time = container.querySelector("time") as HTMLElement;
		expect(time).toHaveTextContent("October 9, 2026");
	});

	it("gives the head its own background, held in place, with the headline over it", () => {
		const { container } = render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		const head = container.querySelector("[data-head]") as HTMLElement;
		for (const part of ["sticky", "top-0", "overflow-hidden"])
			expect(head.className).toContain(part);
		expect(head.className).toContain("h-[50lvh]");
		expect(head.className).not.toContain("85lvh");
		const art = container.querySelector("[data-art]") as HTMLElement;
		expect(art).toHaveAttribute("aria-hidden", "true");
		expect(head.contains(art)).toBe(true);
		expect(head.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
	});

	it("rolls a black sheet over the head as the page scrolls: the sheet comes after it, above it, solid black, and the text on it has no background of its own", () => {
		const { container } = render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		const head = container.querySelector("[data-head]") as HTMLElement;
		const sheet = container.querySelector("[data-sheet]") as HTMLElement;
		expect(head.nextElementSibling).toBe(sheet);
		for (const part of ["relative", "z-10", "bg-black", "px-(--gutter)"])
			expect(sheet.className).toContain(part);
		const body = container.querySelector("[data-body]") as HTMLElement;
		expect(sheet.contains(body)).toBe(true);
		expect(body.className).not.toMatch(/\bbg-/);
		expect(body.className).toContain("mx-auto");
		expect(body.className).toContain("max-w-[48rem]");
	});

	it("is not a legal document: no numbers, no counter, no contents", () => {
		const { container } = render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		expect(
			container.querySelector(
				"[data-clause-number], [data-counter], nav[aria-label='On this page']",
			),
		).toBeNull();
	});

	it("sets a section with a heading, and a section without one runs on", () => {
		render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		const main = within(screen.getByRole("main"));
		expect(main.getAllByRole("heading", { level: 2 })).toHaveLength(1);
		expect(screen.getByText("No heading here.")).toBeInTheDocument();
	});

	it("sets a pulled quote large, as a blockquote, and links and lists as in the legal pages", () => {
		render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		const quote = screen.getByText("A line worth pulling out.");
		expect(quote.closest("blockquote")).not.toBeNull();
		expect(screen.getByRole("link", { name: "the terms" })).toHaveAttribute("href", "/terms");
		expect(within(screen.getByRole("main")).getAllByRole("listitem")).toHaveLength(2);
	});

	it("is just as readable on a phone: body type a size up", () => {
		render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		expect(screen.getByText("Alpha.").className).toContain("max-md:text-[19px]");
	});

	it("names the browser tab after the headline", () => {
		render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		expect(document.title).toContain("A plain headline");
	});
});
