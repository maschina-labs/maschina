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

	it("sets out three groups, videos, decks and the papers, each under its own heading", () => {
		render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const main = within(screen.getByRole("main"));
		expect(
			main.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
		).toEqual(["Videos", "Decks", "The papers"]);
	});

	it("holds a place for every video, deck and paper that is wanted, by name: the index and the fourteen papers in their order", () => {
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

	it("shows each video and deck as a screen of its own, in a 16 by 9 frame, and the papers as a contents list", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		for (const id of ["videos", "decks"]) {
			for (const item of container.querySelectorAll(`[data-group=${id}] [data-item]`)) {
				const screenFrame = item.querySelector("[data-screen]") as HTMLElement;
				expect(screenFrame.className).toContain("aspect-video");
			}
		}
		for (const row of container.querySelectorAll("[data-group=papers] [data-item]")) {
			expect(row.className).toContain("border-b");
			expect(row.querySelector("[data-screen]")).toBeNull();
		}
	});

	it("marks a place that is not ready with a quiet tag, and one that is with a pearl chip and an arrow", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		for (const item of container.querySelectorAll("[data-item]"))
			expect(item.querySelector("[data-soon]")).not.toBeNull();
		const doc = {
			...PAPERS,
			groups: [
				{
					id: "papers",
					heading: "The papers",
					items: [{ name: "Primer", number: "01", href: "https://example.com/primer" }],
				},
			],
		};
		const ready = render(<PapersPage authUrl={AUTH} doc={doc} />);
		const chip = ready.container.querySelector("[data-item] [data-chip]") as HTMLElement;
		expect(chip.className).toContain("bg-[oklch(0.93_0.02_300)]");
		expect(chip.querySelector("svg[data-icon=arrow]")).not.toBeNull();
		expect(ready.container.querySelector("[data-item] [data-soon]")).toBeNull();
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

	it("numbers the index 00 and the fourteen papers from 01 to 14 in order, and puts no mark where a place has no number", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const papers = container.querySelectorAll("[data-group=papers] [data-item]");
		expect(papers).toHaveLength(15);
		const numbers = [...papers].map(
			(item) => item.querySelector("[data-number]")?.textContent ?? null,
		);
		expect(numbers).toEqual(
			Array.from({ length: 15 }, (_, index) => String(index).padStart(2, "0")),
		);
		// There is no Figures group: the figures come in the download.
		expect(container.querySelector("[data-group=figures]")).toBeNull();
	});

	it("has a button to download everything on the page, the figures too, which is not a link until the pack exists", () => {
		const { container } = render(<PapersPage authUrl={AUTH} doc={PAPERS} />);
		const head = container.querySelector("[data-head]") as HTMLElement;
		const button = head.querySelector("[data-download]") as HTMLElement;
		expect(button).toHaveTextContent("Download everything");
		expect(button).toHaveTextContent("Coming soon");
		expect(button.tagName).not.toBe("A");
		expect(button).toHaveAttribute("aria-disabled", "true");
		// No pack, no link: the page still has no dead link.
		expect(within(screen.getByRole("main")).queryAllByRole("link")).toHaveLength(0);
	});

	it("turns the download into a link, with a black chip and a white download icon, the moment there is a pack", () => {
		const doc = { ...PAPERS, pack: "/papers/maschina-papers.zip" };
		const { container } = render(<PapersPage authUrl={AUTH} doc={doc} />);
		const link = within(container.querySelector("[data-head]") as HTMLElement).getByRole("link", {
			name: /Download everything/,
		});
		expect(link).toHaveAttribute("href", "/papers/maschina-papers.zip");
		expect(link).toHaveAttribute("download");
		expect(link.className).toContain("bg-[oklch(0.93_0.02_300)]");
		const chip = link.lastElementChild as HTMLElement;
		expect(chip).toHaveAttribute("data-chip");
		expect(chip.className).toContain("bg-black");
		expect(chip.querySelector("svg[data-icon=download]")).toHaveAttribute("aria-hidden", "true");
		expect(link).not.toHaveTextContent("Coming soon");
	});
});
