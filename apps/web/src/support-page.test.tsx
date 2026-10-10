import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT } from "./company/support.ts";
import { ROUTES } from "./routes.ts";
import { SupportPage } from "./support-page.tsx";

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

describe("the support page", () => {
	it("has the held mesh head and a black sheet over it", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Support");
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("sticky");
		expect(head.nextElementSibling).toBe(container.querySelector("[data-sheet]"));
		expect(document.title).toContain("Support");
	});

	it("offers the ways to get help as cards, each a link to a real page, with writing to support first", () => {
		render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		const main = within(screen.getByRole("main"));
		const cards = main.getAllByRole("link");
		expect(cards[0]).toHaveAttribute("href", "/contact");
		expect(cards[0]).toHaveTextContent("Write to support");
		for (const href of ["/docs", "/status", "/disclosure"])
			expect(cards.map((card) => card.getAttribute("href"))).toContain(href);
		for (const card of cards) {
			const href = card.getAttribute("href") ?? "";
			expect(href.startsWith("https://") || href in ROUTES, href).toBe(true);
		}
	});

	it("has an empty state for help articles, which do not exist yet, rather than a list that is not there", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		const empty = container.querySelector("[data-empty]") as HTMLElement;
		expect(empty).toHaveTextContent("No help articles yet.");
		expect(empty.className).toContain("text-center");
	});

	it("says nothing it cannot back: no reply time, no hours, no team size, no phone number", () => {
		const all = JSON.stringify(SUPPORT);
		expect(all).not.toMatch(
			/within \d|24\/7|hours|business days|phone|call us|team of|\d+ (people|agents)/i,
		);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/lorem|todo|tbd|!/i);
	});

	it("gives the content room: a wide column, on the same left edge as the head's text", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		const inner = container.querySelector("[data-head-text]") as HTMLElement;
		expect(inner.className).toContain("max-w-[64rem]");
		const content = container.querySelector("[data-content]") as HTMLElement;
		expect(content.className).toContain("max-w-[64rem]");
		expect(content.className).toContain("mx-auto");
		expect(content.className).not.toContain("max-w-[44rem]");
	});
});
