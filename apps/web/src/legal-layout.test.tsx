import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Contents, type LegalDoc, LegalPage } from "./legal.tsx";

const AUTH = "https://auth.maschina.dev";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});
afterEach(() => vi.unstubAllGlobals());

const DOC: LegalDoc = {
	title: "Example",
	updated: "October 9, 2026",
	intro: ["The lead."],
	sections: [
		{ heading: "One", body: ["Alpha.", { list: ["a", "b"] }, "Beta."] },
		{ heading: "Two", body: ["Gamma."] },
	],
};

describe("the centered legal page", () => {
	it("gives the head the same held background as the article pages, 50lvh tall, with the title over it on the text's edge", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const head = container.querySelector("[data-head]") as HTMLElement;
		for (const part of ["sticky", "top-0", "overflow-hidden", "h-[50lvh]", "px-(--gutter)"])
			expect(head.className).toContain(part);
		const art = container.querySelector("[data-art]") as HTMLElement;
		expect(art).toHaveAttribute("aria-hidden", "true");
		expect(head.contains(art)).toBe(true);
		const inner = container.querySelector("[data-head-text]") as HTMLElement;
		expect(inner.className).toContain("mx-auto");
		expect(inner.className).toContain("max-w-[44rem]");
		expect(inner).toHaveTextContent("Last updated October 9, 2026");
		expect(inner.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
	});

	it("rolls a black sheet over the head: the lead and the text sit on it, with the page margins, and the text has no background of its own", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const head = container.querySelector("[data-head]") as HTMLElement;
		const sheet = container.querySelector("[data-sheet]") as HTMLElement;
		expect(head.nextElementSibling).toBe(sheet);
		for (const part of ["relative", "z-10", "bg-black", "px-(--gutter)"])
			expect(sheet.className).toContain(part);
		expect(sheet.contains(screen.getByText("The lead."))).toBe(true);
		const text = container.querySelector("[data-text]") as HTMLElement;
		expect(sheet.contains(text)).toBe(true);
		expect(text.className).not.toMatch(/\bbg-/);
		expect(text.className).toContain("mx-auto");
		expect(text.className).toContain("max-w-[44rem]");
		const layout = container.querySelector("[data-layout]") as HTMLElement;
		expect(layout.className).toContain("xl:grid-cols-[minmax(0,1fr)_44rem_minmax(0,1fr)]");
		expect(layout.className).not.toMatch(/border/);
	});

	it("keeps every line of text on one edge: no heading, clause or list is stepped in", () => {
		render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const heading = screen.getByRole("heading", { level: 2, name: "One" });
		expect(heading.className).not.toMatch(/\b(pl|ml|pr)-/);
		const clause = screen.getByText("Alpha.").parentElement as HTMLElement;
		expect(clause.className).not.toMatch(/\bml-|grid/);
		const list = screen.getByText("a").closest("ul") as HTMLElement;
		expect(list.className).not.toMatch(/\bml-/);
		expect(list.className).toContain("list-[square]");
	});

	it("hangs each clause's number in the margin beside it, small and faint, outside the text", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const numbers = [...container.querySelectorAll("[data-clause-number]")];
		expect(numbers.map((node) => node.textContent)).toEqual(["1.1", "1.2", "2.1"]);
		for (const node of numbers) {
			expect(node).toHaveAttribute("aria-hidden", "true");
			for (const part of [
				"absolute",
				"-left-14",
				"text-[12px]",
				"text-neutral-700",
				"max-lg:hidden",
			])
				expect(node.className).toContain(part);
		}
		const first = numbers[0] as HTMLElement;
		expect((first.parentElement as HTMLElement).className).toContain("relative");
	});

	it("keeps the counter that follows the reading, small, further out in the margin than the clause numbers, still rolling like an odometer", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const counter = container.querySelector("[data-counter]") as HTMLElement;
		const pin = counter.parentElement as HTMLElement;
		for (const part of ["sticky", "top-28", "h-0", "max-lg:hidden"])
			expect(pin.className).toContain(part);
		for (const part of ["-ml-36", "text-[14px]", "tabular-nums"])
			expect(counter.className).toContain(part);
		const odometer = counter.querySelector("[data-odometer]") as HTMLElement;
		expect(odometer.className).toContain("overflow-hidden");
		const strip = odometer.firstElementChild as HTMLElement;
		expect([...strip.children].map((entry) => entry.textContent)).toEqual(["1", "2"]);
		expect(strip.className).toContain("motion-reduce:transition-none");
		// The dot stays still; only the number rolls.
		expect(odometer.querySelector("[data-dot]")).toBeNull();
		expect(counter.querySelector("[data-dot]")).not.toBeNull();
	});

	it("puts the small contents down the right of a very wide screen only, and none anywhere else", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const side = screen.getByRole("navigation", { name: "On this page" });
		for (const part of ["hidden", "xl:block", "xl:sticky", "xl:top-28", "text-[13px]"])
			expect(side.className).toContain(part);
		expect(container.querySelector("details")).toBeNull();
		expect(
			within(side)
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual(["#one", "#two"]);
	});

	it("is just text on a phone: the type a size up, nothing hanging in the margin", () => {
		render(<LegalPage authUrl={AUTH} doc={DOC} />);
		expect(screen.getByText("Alpha.").className).toContain("max-md:text-[18px]");
		expect(screen.getByRole("heading", { level: 2, name: "One" }).className).toContain(
			"max-md:text-[1.5rem]",
		);
	});

	it("still brings a section to the middle of the screen when the contents are used", () => {
		const scrollTo = vi.fn();
		window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
		Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
		);
		render(<LegalPage authUrl={AUTH} doc={DOC} />);
		const section = screen
			.getByRole("heading", { level: 2, name: "Two" })
			.closest("section") as HTMLElement;
		vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
			top: 1000,
			height: 400,
			bottom: 1400,
			left: 0,
			right: 0,
			width: 0,
			x: 0,
			y: 1000,
			toJSON() {},
		});
		fireEvent.click(
			within(screen.getByRole("navigation", { name: "On this page" })).getByRole("link", {
				name: "2Two",
			}),
		);
		expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: "smooth" });
	});
});

describe("the contents follow the reading", () => {
	const box = (top: number, height: number) =>
		({
			top,
			height,
			bottom: top + height,
			left: 0,
			right: 0,
			width: 0,
			x: 0,
			y: top,
			toJSON() {},
		}) as DOMRect;

	function setup(current: string, tops: Record<string, number>) {
		const view = render(
			<nav aria-label="On this page" style={{ overflowY: "auto" }}>
				<Contents doc={DOC} current={current} className="flex flex-col" />
			</nav>,
		);
		const nav = screen.getByRole("navigation", { name: "On this page" });
		vi.spyOn(nav, "getBoundingClientRect").mockReturnValue(box(100, 400));
		for (const [name, top] of Object.entries(tops)) {
			const link = screen.getByRole("link", { name: new RegExp(name) });
			vi.spyOn(link, "getBoundingClientRect").mockReturnValue(box(top, 30));
		}
		return { nav, view };
	}

	it("scrolls the list so the section being read stays inside it, once the reading passes what the list can show", () => {
		const { nav, view } = setup("one", { One: 120, Two: 700 });
		nav.scrollTop = 0;
		view.rerender(
			<nav aria-label="On this page" style={{ overflowY: "auto" }}>
				<Contents doc={DOC} current="two" className="flex flex-col" />
			</nav>,
		);
		// The lit line is centered in the list: it sits 600 below the list's top, the list shows 400 of it, so 600 - 200 + 15.
		expect(nav.scrollTop).toBe(415);
	});

	it("leaves the list where it is while the lit line is already in view", () => {
		const { nav, view } = setup("one", { One: 120, Two: 200 });
		nav.scrollTop = 40;
		view.rerender(
			<nav aria-label="On this page" style={{ overflowY: "auto" }}>
				<Contents doc={DOC} current="two" className="flex flex-col" />
			</nav>,
		);
		expect(nav.scrollTop).toBe(40);
	});

	it("never scrolls the page itself, only the list", () => {
		const scrollIntoView = vi.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
		const { view } = setup("one", { One: 120, Two: 700 });
		view.rerender(
			<nav aria-label="On this page" style={{ overflowY: "auto" }}>
				<Contents doc={DOC} current="two" className="flex flex-col" />
			</nav>,
		);
		expect(scrollIntoView).not.toHaveBeenCalled();
	});
});

describe("the contents light the section being read", () => {
	const box = (top: number, height: number) =>
		({
			top,
			height,
			bottom: top + height,
			left: 0,
			right: 0,
			width: 0,
			x: 0,
			y: top,
			toJSON() {},
		}) as DOMRect;

	function readAt(tops: [number, number]) {
		Object.defineProperty(document.documentElement, "scrollHeight", {
			configurable: true,
			value: 5000,
		});
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
		render(<LegalPage authUrl={AUTH} doc={DOC} />);
		for (const [index, name] of ["One", "Two"].entries()) {
			const section = screen
				.getByRole("heading", { level: 2, name })
				.closest("section") as HTMLElement;
			vi.spyOn(section, "getBoundingClientRect").mockReturnValue(box(tops[index] ?? 0, 300));
		}
		if (window.scrollY > 0)
			Object.defineProperty(document.documentElement, "scrollHeight", {
				configurable: true,
				value: 2000,
			});
		fireEvent.scroll(window);
		return within(screen.getByRole("navigation", { name: "On this page" }));
	}

	it("lights the last section reached by the middle of the screen", () => {
		// Two starts 500 down a 800 tall screen, under the middle line (400), so One is still the one being read.
		expect(readAt([-200, 500]).getByRole("link", { name: "1One" })).toHaveAttribute(
			"aria-current",
			"location",
		);
	});

	it("lights the last section when the page has run out, even if that short section never reaches the middle", () => {
		Object.defineProperty(document.documentElement, "scrollHeight", {
			configurable: true,
			value: 2000,
		});
		Object.defineProperty(window, "scrollY", { configurable: true, value: 1200 });
		expect(readAt([-900, 600]).getByRole("link", { name: "2Two" })).toHaveAttribute(
			"aria-current",
			"location",
		);
		Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
	});

	it("moves to the next section as soon as its top passes the middle of the screen", () => {
		expect(readAt([-500, 380]).getByRole("link", { name: "2Two" })).toHaveAttribute(
			"aria-current",
			"location",
		);
	});
});
