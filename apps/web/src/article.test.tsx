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
	it("opens like a newsletter: a small label, a big centered headline, a standfirst, and who wrote it and when", () => {
		const { container } = render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A plain headline");
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("text-center");
		expect(head).toHaveTextContent("Company");
		expect(head).toHaveTextContent("One sentence that says what this is.");
		expect(head).toHaveTextContent("By Asher Wilson");
		const time = container.querySelector("time") as HTMLElement;
		expect(time).toHaveTextContent("October 9, 2026");
	});

	it("sets the body in one narrow column in the middle, with page margins on the article", () => {
		const { container } = render(<ArticlePage authUrl={AUTH} doc={DOC} />);
		expect((container.querySelector("article") as HTMLElement).className).toContain(
			"px-(--gutter)",
		);
		const body = container.querySelector("[data-body]") as HTMLElement;
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
