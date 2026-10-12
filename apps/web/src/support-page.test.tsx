import { fireEvent, render, screen, within } from "@testing-library/react";
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

const search = () => screen.getByRole("searchbox", { name: "Search for help" });

describe("the support page, as a help center", () => {
	it("has the held mesh head and a black sheet over it", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Support");
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("sticky");
		expect(head.nextElementSibling).toBe(container.querySelector("[data-sheet]"));
		expect(document.title).toContain("Support");
	});

	it("starts with a search box for the help pages, with nothing typed in it", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		expect(search()).toHaveValue("");
		// The search landmark is the HTML element for it, so a reader can jump straight to it.
		expect(container.querySelector("search")).toContainElement(search());
	});

	it("sorts the help into topics, each with the real pages that help with it, every one a link to a page that exists", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		const topics = [...container.querySelectorAll("[data-topic]")] as HTMLElement[];
		expect(topics.map((topic) => topic.querySelector("h2")?.textContent)).toEqual([
			"Getting started",
			"Safety and risk",
			"Terms and privacy",
			"About Maschina",
		]);
		const first = within(topics[0] as HTMLElement).getAllByRole("link");
		expect(first.map((link) => link.getAttribute("href"))).toEqual([
			"/product",
			"/how-it-works",
			"/machines",
		]);
		expect(first.map((link) => link.textContent)).toEqual(["Product", "How It Works", "Machines"]);
		for (const topic of topics)
			for (const link of within(topic).getAllByRole("link"))
				expect(
					ROUTES[link.getAttribute("href") ?? ""],
					link.getAttribute("href") ?? "",
				).toBeDefined();
	});

	it("narrows to the pages that match what is typed, whatever the case, and shows which topic each is in", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		fireEvent.change(search(), { target: { value: "RISK" } });
		expect(container.querySelector("[data-topics]")).toBeNull();
		const results = container.querySelector("[data-results]") as HTMLElement;
		const names = within(results)
			.getAllByRole("link")
			.map((link) => link.textContent);
		expect(names.some((name) => /Risk Disclosure/.test(name ?? ""))).toBe(true);
		expect(names.some((name) => /How It Works/.test(name ?? ""))).toBe(false);
		expect(results).toHaveTextContent("Safety and risk");
	});

	it("matches a topic's own name too, and goes back to the topics when the box is cleared", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		fireEvent.change(search(), { target: { value: "terms and priv" } });
		const results = container.querySelector("[data-results]") as HTMLElement;
		expect(within(results).getAllByRole("link").length).toBe(3);
		fireEvent.change(search(), { target: { value: "" } });
		expect(container.querySelector("[data-results]")).toBeNull();
		expect(container.querySelectorAll("[data-topic]")).toHaveLength(4);
	});

	it("says plainly when nothing matches, and offers writing to support instead of an empty page", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		fireEvent.change(search(), { target: { value: "zzzzzz" } });
		const none = container.querySelector("[data-none]") as HTMLElement;
		expect(none).toHaveTextContent("No help pages match that");
		expect(within(none).getByRole("link", { name: /Write to support/ })).toHaveAttribute(
			"href",
			"/contact",
		);
	});

	it("keeps the other ways to get help, with writing to support first, each a link to a real page", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		const ways = [...container.querySelectorAll("[data-way]")] as HTMLElement[];
		expect(ways).toHaveLength(4);
		expect(ways[0]).toHaveAttribute("href", "/contact");
		expect(ways[0]).toHaveTextContent("Write to support");
		for (const way of ways) {
			const href = way.getAttribute("href") ?? "";
			expect(href.startsWith("https://") || href in ROUTES, href).toBe(true);
			expect(way.querySelector("[data-chip]")).toHaveAttribute("aria-hidden", "true");
		}
		expect(
			screen.getByRole("heading", { level: 2, name: "Other ways to get help" }),
		).toBeInTheDocument();
	});

	it("has an empty state for help articles, which do not exist yet, with a skeleton, rather than a list that is not there", () => {
		const { container } = render(<SupportPage authUrl={AUTH} doc={SUPPORT} />);
		const empty = container.querySelector("[data-empty]") as HTMLElement;
		expect(empty).toHaveTextContent("No help articles yet.");
		expect(empty.className).toContain("text-center");
		expect(empty.querySelector("[aria-hidden=true]")).not.toBeNull();
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
