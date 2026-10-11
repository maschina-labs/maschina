import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPERS } from "./company/papers.ts";
import { PapersPage } from "./papers-page.tsx";

const AUTH = "https://auth.maschina.dev";

beforeEach(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => vi.unstubAllGlobals());

describe("the papers page", () => {
	it("has the held mesh head and a black sheet over it, and the tab says Papers", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Papers");
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("sticky");
		expect(head.nextElementSibling).toBe(container.querySelector("[data-sheet]"));
		expect(document.title).toBe("Papers | Maschina");
	});

	it("sets out four groups, videos, decks, the papers and their figures, each under its own heading", () => {
		render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const main = within(screen.getByRole("main"));
		expect(
			main.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
		).toEqual(["Videos", "Decks", "The papers", "Figures"]);
	});

	it("holds a place for every video, deck, paper and figure that is wanted, by name: the index and the fourteen papers in their order", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const names = [...container.querySelectorAll("[data-item] [data-name]")].map(
			(node) => node.textContent,
		);
		expect(names).toEqual([
			"Demo video",
			"Pitch video",
			"Pitch deck",
			"Investor deck",
			"Index",
			"Primer",
			"Whitepaper",
			"Protocol and Architecture",
			"Security and Custody",
			"The Machine",
			"The Surface",
			"The Network",
			"The Machine Economy",
			"Integrity",
			"Economics",
			"The Path",
			"Using Maschina",
			"Building on Maschina",
			"Risk and Disclosures",
			"All figures",
		]);
	});

	it("says Coming soon on each place that has nothing in it yet, and links none of them, so there is no dead link", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const items = [...container.querySelectorAll("[data-item]")];
		for (const item of items) {
			expect(item).toHaveTextContent("Coming soon");
			expect(item.querySelector("a")).toBeNull();
		}
		expect(within(screen.getByRole("main")).queryAllByRole("link")).toHaveLength(0);
	});

	it("turns a place into a link, with an arrow, the moment it has an address", () => {
		const doc = {
			...PAPERS,
			groups: [
				{
					id: "videos",
					heading: "Videos",
					items: [{ name: "Demo video", body: "Shown.", href: "https://youtu.be/example" }],
				},
			],
		};
		const { container } = render(<PapersPage authUrl={AUTH} doc={doc} />);
		const link = within(screen.getByRole("main")).getByRole("link", { name: /Demo video/ });
		expect(link).toHaveAttribute("href", "https://youtu.be/example");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link.getAttribute("rel")).toContain("noopener");
		expect(container.querySelector("[data-item] svg[data-icon=arrow]")).not.toBeNull();
		expect(container.querySelector("[data-item]")).not.toHaveTextContent("Coming soon");
	});

	it("makes every card the same size", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		for (const grid of container.querySelectorAll("[data-group]")) {
			expect(grid.className).toContain("auto-rows-fr");
			for (const item of grid.querySelectorAll("[data-item]")) {
				expect(item.className).toContain("h-full");
				expect(item.className).toMatch(/min-h-(36|44)/);
			}
		}
	});

	it("says what each will be without promising a date, a figure or a result, in the company's own serious voice", () => {
		const all = JSON.stringify(PAPERS);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|!/i);
		expect(all).not.toMatch(/\b(I|I'm|my|me)\b/);
		expect(all).not.toMatch(/\d+%|\$\d|\b20(2[7-9]|3\d)\b|q[1-4]\b|profit|returns of|guarantee/i);
		expect(all).not.toMatch(/\b(audited by|raised|funding|partner)\b/i);
	});

	it("numbers the fourteen papers from 01 to 14 in order, and leaves the index without a number", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const papers = container.querySelectorAll("[data-group=papers] [data-item]");
		expect(papers).toHaveLength(15);
		const numbers = [...papers].map(
			(item) => item.querySelector("[data-number]")?.textContent ?? null,
		);
		expect(numbers).toEqual([
			null,
			...Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, "0")),
		]);
	});
});
