import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
		{ heading: "One", body: ["Alpha.", { list: ["a", "b"] }, "Beta."] },
		{ heading: "Two", body: ["Gamma."] },
	],
};

describe("a legal page", () => {
	it("opens with a big plain title, a small label above it, the date under it, and the first words as a lead", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const main = screen.getByRole("main");
		const title = within(main).getByRole("heading", { level: 1, name: "Example" });
		for (const part of ["font-medium", "text-white", "tracking-[-0.04em]"])
			expect(title.className).toContain(part);
		expect(title.className).not.toMatch(/bg-clip-text|text-stroke|text-transparent/);
		expect(within(main).getByText("Legal")).toBeInTheDocument();
		expect(within(main).getByText("Last updated October 9, 2026")).toBeInTheDocument();
		const lead = within(main).getByText("First paragraph.");
		expect(lead.className).toMatch(/text-\[(18|19|20)px\]/);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});

	it("keeps the page margins on the article, so the text starts at the left margin and the contents end at the right one", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const article = screen.getByRole("main").querySelector("article") as HTMLElement;
		expect(article.className).toContain("px-(--gutter)");
		expect(article.className).not.toMatch(/max-w-/);
		const column = article.firstElementChild as HTMLElement;
		expect(column).toHaveAttribute("data-column");
		// No centered box: the text starts at the page's left margin, in line with the logo, and the contents end at the right margin.
		expect(column.className).not.toMatch(/mx-auto|max-w-/);
		expect(column.className).not.toContain("px-");
	});

	it("puts the text in a reading column on the left and a small contents down the right on a wide screen, held in view while the text is read", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const layout = container.querySelector("[data-layout]") as HTMLElement;
		// The text is on the left, in its reading column, and a small contents on the right.
		expect(layout.className).toContain("lg:grid-cols-[minmax(0,1fr)_12rem]");
		// No line between the title and the text, nor under the folded contents on a phone.
		expect(layout.className).not.toMatch(/border/);
		expect(screen.getByText("Contents").closest("details")?.className ?? "").not.toMatch(/border/);
		const side = screen.getByRole("navigation", { name: "On this page" });
		expect(side.className).toContain("text-[13px]");
		expect(side.className).toContain("lg:sticky");
		expect(side.className).toContain("lg:top-28");
		const links = within(side).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["1One", "2Two"]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["#one", "#two"]);
		const text = container.querySelector("[data-text]") as HTMLElement;
		expect(text.className).toContain("max-w-[50rem]");
		// On a phone the contents come first, above the text; on a wide screen they sit after it, on the right.
		const sideBox = side.parentElement as HTMLElement;
		expect(sideBox.className).toContain("order-first");
		expect(sideBox.className).toContain("lg:order-none");
		expect(text.compareDocumentPosition(sideBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("folds the contents into a list at the top on a phone, where there is no room for a side column", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const folded = screen.getByText("Contents").closest("details") as HTMLElement;
		expect(folded.className).toContain("lg:hidden");
		expect(within(folded).getAllByRole("link")).toHaveLength(2);
		const side = screen.getByRole("navigation", { name: "On this page" });
		expect(side.className).toContain("hidden");
		expect(side.className).toContain("lg:block");
	});

	it("numbers every section, and gives every clause its number as an address, so any part can be pointed to", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const one = screen.getByRole("heading", { level: 2, name: "One" });
		expect(one).toHaveAttribute("id", "one");
		expect(one.className).toContain("font-medium");
		// The heading is only its words; the number is a separate thing that stays put (see below).
		expect(one).toHaveTextContent(/^One$/);
		const clauses = [...container.querySelectorAll("[data-clause-id]")].map((node) =>
			node.getAttribute("data-clause-id"),
		);
		expect(clauses).toEqual(["1.1", "1.2", "2.1"]);
		// Each clause's number is printed beside it, in the margin, and scrolls by with it; the counter at the far left changes as each one reaches it.
		const printed = [...container.querySelectorAll("[data-clause-number]")];
		expect(printed.map((node) => node.textContent)).toEqual(["1.1", "1.2", "2.1"]);
		for (const node of printed) {
			expect(node).toHaveAttribute("aria-hidden", "true");
			expect(node.className).toContain("tabular-nums");
		}
		const row = printed[0]?.parentElement as HTMLElement;
		expect(row.className).toContain("ml-16");
		expect(row.className).toContain("grid-cols-[3rem_minmax(0,1fr)]");
		const list = screen.getByText("a").closest("ul") as HTMLElement;
		expect(list.className).toContain("list-[square]");
	});

	it("keeps a counter pinned at the left under the header while a section is read, level with the heading when it starts, and taking no room of its own", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const heading = screen.getByRole("heading", { level: 2, name: "One" });
		const section = heading.closest("section") as HTMLElement;
		const pin = section.querySelector("[data-counter]")?.parentElement as HTMLElement;
		for (const part of ["sticky", "top-28", "z-10", "h-0"]) expect(pin.className).toContain(part);
		expect(pin.nextElementSibling).toBe(heading);
		const counter = pin.firstElementChild as HTMLElement;
		expect(counter).toHaveAttribute("aria-hidden", "true");
		expect(counter.className).toContain("bg-black");
		expect(counter.className).toContain("tabular-nums");
		// The section's number is the bright part and the clause after the dot is the quieter one; neither is left dim next to a lit one.
		expect(counter.className).toContain("text-neutral-200");
		expect(counter.querySelector("[data-odometer] span span")?.className).toContain(
			"text-neutral-500",
		);
		expect(counter.querySelector("[data-dot]")?.className).toContain("text-neutral-500");
		// The heading's text starts where the counter ends.
		expect(heading.className).toContain("pl-16");
		// It starts at the first clause of its section.
		expect(counter).toHaveTextContent(/^1/);
		expect(counter.querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
	});

	describe("the counter counts as the clauses are read", () => {
		const LINE = 140;
		const place = (id: string, top: number, height: number) => {
			const node = document.querySelector(`[data-clause-id="${id}"]`) as HTMLElement;
			vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
				top,
				height,
				bottom: top + height,
				left: 0,
				right: 0,
				width: 0,
				x: 0,
				y: top,
				toJSON() {},
			});
		};
		const counter = (section: string) =>
			(
				screen.getByRole("heading", { level: 2, name: section }).closest("section") as HTMLElement
			).querySelector("[data-counter]") as HTMLElement;
		const scroll = () => act(() => void fireEvent.scroll(window));

		it("shows the clause that is crossing the line just under the header, and goes up one as the next one reaches it", () => {
			render(<LegalPage authUrl={AUTH} doc={SMALL} />);
			// Section one's clauses: 1.1 is crossing the line.
			place("1.1", LINE - 50, 200);
			place("1.2", LINE + 150, 100);
			place("2.1", LINE + 400, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
			// Scrolled on: 1.1 has passed and 1.2 is crossing the line.
			place("1.1", LINE - 300, 200);
			place("1.2", LINE - 60, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "2");
			expect(counter("Two").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
		});

		it("holds the last clause of a section it has passed, and the first of one it has not reached", () => {
			render(<LegalPage authUrl={AUTH} doc={SMALL} />);
			place("1.1", LINE - 600, 200);
			place("1.2", LINE - 300, 100);
			place("2.1", LINE - 20, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "2");
			expect(counter("Two").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
			place("1.1", LINE + 300, 200);
			place("1.2", LINE + 600, 100);
			place("2.1", LINE + 900, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
		});

		it("rolls like an odometer: the numbers sit in a strip behind a window, and the strip slides up to the next as the reading goes on", () => {
			render(<LegalPage authUrl={AUTH} doc={SMALL} />);
			const window_ = counter("One").querySelector("[data-odometer]") as HTMLElement;
			// A window the height of one number, hiding the rest of the strip.
			expect(window_.className).toContain("overflow-hidden");
			expect(window_.className).toContain("h-[1.25em]");
			const strip = window_.firstElementChild as HTMLElement;
			// One entry for each clause the section has, 1 and 2 for section one, so it can pass through each as it goes. Only the
			// number rolls: the dot in front of it stays where it is.
			expect([...strip.children].map((entry) => entry.textContent)).toEqual(["1", "2"]);
			const dot = counter("One").querySelector("[data-dot]") as HTMLElement;
			expect(dot).toHaveTextContent(".");
			expect(window_.contains(dot)).toBe(false);
			expect(dot.nextElementSibling).toBe(window_);
			expect(strip.style.transform).toBe("translateY(0em)");
			expect(strip.className).toContain("transition-transform");
			expect(strip.className).toContain("motion-reduce:transition-none");
			place("1.1", LINE - 300, 200);
			place("1.2", LINE - 60, 100);
			place("2.1", LINE + 400, 100);
			scroll();
			expect(window_).toHaveAttribute("data-value", "2");
			expect(strip.style.transform).toBe("translateY(-1.25em)");
		});
	});

	describe("the counter counts as the clauses are read", () => {
		const LINE = 140;
		const place = (id: string, top: number, height: number) => {
			const node = document.querySelector(`[data-clause-id="${id}"]`) as HTMLElement;
			vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
				top,
				height,
				bottom: top + height,
				left: 0,
				right: 0,
				width: 0,
				x: 0,
				y: top,
				toJSON() {},
			});
		};
		const counter = (section: string) =>
			(
				screen.getByRole("heading", { level: 2, name: section }).closest("section") as HTMLElement
			).querySelector("[data-counter]") as HTMLElement;
		const scroll = () => act(() => void fireEvent.scroll(window));

		it("shows the clause that is crossing the line just under the header, and goes up one as the next one reaches it", () => {
			render(<LegalPage authUrl={AUTH} doc={SMALL} />);
			// Section one's clauses: 1.1 is crossing the line.
			place("1.1", LINE - 50, 200);
			place("1.2", LINE + 150, 100);
			place("2.1", LINE + 400, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
			// Scrolled on: 1.1 has passed and 1.2 is crossing the line.
			place("1.1", LINE - 300, 200);
			place("1.2", LINE - 60, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "2");
			expect(counter("Two").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
		});

		it("holds the last clause of a section it has passed, and the first of one it has not reached", () => {
			render(<LegalPage authUrl={AUTH} doc={SMALL} />);
			place("1.1", LINE - 600, 200);
			place("1.2", LINE - 300, 100);
			place("2.1", LINE - 20, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "2");
			expect(counter("Two").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
			place("1.1", LINE + 300, 200);
			place("1.2", LINE + 600, 100);
			place("2.1", LINE + 900, 100);
			scroll();
			expect(counter("One").querySelector("[data-odometer]")).toHaveAttribute("data-value", "1");
		});
	});

	it("sets the text for reading: seventeen pixel type, roomy lines, a calm gray that is bright enough, and headings that step up with room above them", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const paragraph = screen.getByText("Alpha.");
		for (const part of ["text-[17px]", "leading-[1.7]", "text-neutral-300"])
			expect(paragraph.className).toContain(part);
		const second = screen
			.getByRole("heading", { level: 2, name: "Two" })
			.closest("section") as HTMLElement;
		expect(second.className).toContain("pt-14");
		expect(second.className).toContain("scroll-mt-28");
		expect(screen.getByRole("main").className).not.toMatch(/animate-/);
	});

	it("renders links inside the text, underlined", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const link = screen.getByRole("link", { name: "the privacy policy" });
		expect(link).toHaveAttribute("href", "/privacy");
		expect(link.className).toContain("underline");
	});

	it("names the browser tab after the document", () => {
		document.title = "Maschina";
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		expect(document.title).toBe("Example · Maschina");
	});
});

describe("jumping to a section from the contents", () => {
	const SHELL = "(hover: none) and (pointer: coarse)";
	let scrollTo: ReturnType<typeof vi.fn>;
	let root: HTMLDivElement | undefined;

	const section = (id: string) => document.getElementById(id)?.closest("section") as HTMLElement;
	const size = (id: string, top: number, height: number) => {
		vi.spyOn(section(id), "getBoundingClientRect").mockReturnValue({
			top,
			height,
			bottom: top + height,
			left: 0,
			right: 0,
			width: 0,
			x: 0,
			y: top,
			toJSON() {},
		});
	};
	const link = (name: string) =>
		within(screen.getByRole("navigation", { name: "On this page" })).getByRole("link", { name });

	beforeEach(() => {
		scrollTo = vi.fn();
		window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
		Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
		);
	});
	afterEach(() => {
		root?.remove();
		root = undefined;
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("brings the section to the middle of the screen, working out the place once and going straight there, so nothing drifts", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		size("two", 1000, 400);
		const click = fireEvent.click(link("2Two"));
		expect(click).toBe(false);
		expect(scrollTo).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: "smooth" });
	});

	it("puts the top of a section taller than the screen just under the header, and does not glide for anyone who asked for less motion", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		size("one", 1000, 1500);
		fireEvent.click(link("1One"));
		expect(scrollTo).toHaveBeenCalledWith({ top: 1004, behavior: "smooth" });
		scrollTo.mockClear();
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query: string) => ({
				matches: query.includes("prefers-reduced-motion"),
				addEventListener() {},
				removeEventListener() {},
			})),
		);
		size("two", 1000, 400);
		fireEvent.click(link("2Two"));
		expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: "auto" });
	});

	it("scrolls the root box instead of the window on a touch screen", () => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query: string) => ({
				matches: query === SHELL,
				addEventListener() {},
				removeEventListener() {},
			})),
		);
		root = document.createElement("div");
		root.id = "root";
		document.body.appendChild(root);
		Object.defineProperty(root, "clientHeight", { configurable: true, value: 700 });
		root.scrollTop = 50;
		const rootScroll = vi.fn();
		root.scrollTo = rootScroll as unknown as typeof root.scrollTo;
		render(<LegalPage authUrl={AUTH} doc={SMALL} />, {
			container: root.appendChild(document.createElement("div")),
		});
		size("two", 900, 300);
		fireEvent.click(link("2Two"));
		expect(rootScroll).toHaveBeenCalledWith({ top: 750, behavior: "smooth" });
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("keeps the address in step with the section, without jumping, and moves the keyboard to its heading", () => {
		const replace = vi.spyOn(window.history, "replaceState");
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		size("two", 1000, 400);
		fireEvent.click(link("2Two"));
		expect(replace).toHaveBeenCalledWith(null, "", "#two");
		const heading = screen.getByRole("heading", { level: 2, name: "Two" });
		expect(heading).toHaveAttribute("tabindex", "-1");
		expect(document.activeElement).toBe(heading);
	});
});

describe("the terms of service", () => {
	const flat = (parts: (string | { text: string; href: string })[]) =>
		parts.map((x) => (typeof x === "string" ? x : x.text)).join("");
	const text = (doc: LegalDoc) =>
		[
			doc.title,
			...(doc.intro ?? []).map((p) => (typeof p === "string" ? p : flat(p))),
			...doc.sections.flatMap((s) => [
				s.heading,
				...s.body.flatMap((b) =>
					typeof b === "string" ? [b] : Array.isArray(b) ? [flat(b)] : b.list,
				),
			]),
		].join("\n");

	it("covers what the terms of a service like this have to cover", () => {
		const headings = TERMS.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/who we are/i,
			/who can use/i,
			/wallet/i,
			/machines/i,
			/financial advice/i,
			/risk/i,
			/fees/i,
			/third.party/i,
			/what you may not do/i,
			/our property/i,
			/suspending/i,
			/disclaimer/i,
			/liability/i,
			/governing law/i,
			/changes/i,
			/contact/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("is dated, and only ever writes the way the site does: no long dashes, no placeholders, no AI wording", () => {
		expect(TERMS.updated).toBe("October 9, 2026");
		const all = text(TERMS);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/\bTODO\b|\bTBD\b|\[[^\]]*\]|lorem|placeholder/i);
		expect(all).not.toMatch(/\bAI[- ]generated\b|written by an AI|ChatGPT|Claude/i);
		expect(all).not.toMatch(/!/);
	});

	it("never promises a result, safety it cannot prove, or anything not built", () => {
		const all = text(TERMS);
		expect(all).not.toMatch(/guarantee(s|d)? (profit|returns|that you will)/i);
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
		expect(hrefs).toContain("mailto:legal@maschina.dev");
	});

	it("sets out who runs it, where the law is, and how to reach them, in plain words", () => {
		const all = text(TERMS);
		expect(all).toMatch(/Maschina Labs/);
		expect(all).toMatch(/Alberta/);
		expect(all).toMatch(/legal@maschina\.dev/);
		expect(all).toMatch(/18/);
	});
});
