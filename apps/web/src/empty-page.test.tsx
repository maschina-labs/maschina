import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAREERS, NEWS } from "./company/empty.ts";
import { EmptyPage } from "./empty-page.tsx";
import { ROUTES } from "./routes.ts";

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

describe("an empty page", () => {
	it("has the held mesh head and a black sheet over it, with the empty state in the middle of the sheet", () => {
		const { container } = render(<EmptyPage authUrl={AUTH} doc={NEWS} />);
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("sticky");
		const sheet = container.querySelector("[data-sheet]") as HTMLElement;
		expect(head.nextElementSibling).toBe(sheet);
		expect(sheet.className).toContain("bg-black");
		const empty = container.querySelector("[data-empty]") as HTMLElement;
		expect(sheet.contains(empty)).toBe(true);
		expect(empty.className).toContain("mx-auto");
		expect(empty.className).toContain("text-center");
	});

	it("says in a plain line that there is nothing here yet, and what to do in the meantime", () => {
		render(<EmptyPage authUrl={AUTH} doc={NEWS} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("News");
		expect(within(screen.getByRole("main")).getByRole("heading", { level: 2 })).toHaveTextContent(
			"Nothing to announce yet.",
		);
		expect(within(screen.getByRole("main")).getByRole("link", { name: "X" })).toHaveAttribute(
			"href",
			"https://x.com/maschinalabs",
		);
		expect(document.title).toContain("News");
	});

	it("is the same for careers: no openings, said plainly, and no invented role", () => {
		render(<EmptyPage authUrl={AUTH} doc={CAREERS} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Careers");
		expect(within(screen.getByRole("main")).getByRole("heading", { level: 2 })).toHaveTextContent(
			"No open roles right now.",
		);
		expect(within(screen.getByRole("main")).getByRole("link", { name: "Contact" })).toHaveAttribute(
			"href",
			"/contact",
		);
	});
});

describe("what the empty pages say", () => {
	const words = (doc: typeof NEWS) => [doc.title, doc.standfirst, doc.heading, doc.body].join("\n");

	it.each([
		["news", NEWS],
		["careers", CAREERS],
	])(
		"%s is written seriously, with no long dashes, no placeholders, no shouting, no first person",
		(_name, doc) => {
			const all = words(doc);
			expect(all).not.toMatch(
				new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
			);
			expect(all).not.toMatch(/lorem|todo|tbd|\bxxx\b|!/i);
			expect(all).not.toMatch(/\b(I|I'm|I've|my|me)\b/);
		},
	);

	it.each([
		["news", NEWS],
		["careers", CAREERS],
	])("%s links only to real places", (_name, doc) => {
		for (const link of doc.links)
			expect(link.href.startsWith("https://") || link.href in ROUTES, link.href).toBe(true);
	});

	it("invents nothing: no partner, no funding, no team size, no salary, no open role", () => {
		const all = [words(NEWS), words(CAREERS)].join("\n");
		expect(all).not.toMatch(
			/\b(partner|partnership|raised|funding|salary|equity|remote|full.time|engineer(ing)? role)\b/i,
		);
	});
});
