import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCEPTABLE_USE } from "./legal/acceptable-use.ts";
import { DISCLOSURE } from "./legal/disclosure.ts";
import { LICENSE } from "./legal/license.ts";
import { PRIVACY } from "./legal/privacy.ts";
import { RISK } from "./legal/risk.ts";
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
		// No line between the title and the text.
		expect(layout.className).not.toMatch(/border/);
		const side = screen.getByRole("navigation", { name: "On this page" });
		expect(side.className).toContain("text-[13px]");
		expect(side.className).toContain("lg:sticky");
		expect(side.className).toContain("lg:top-28");
		const links = within(side).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["1One", "2Two"]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["#one", "#two"]);
		const text = container.querySelector("[data-text]") as HTMLElement;
		expect(text.className).toContain("max-w-[50rem]");
		// On a wide screen the contents sit after the text, on the right.
		const sideBox = side.parentElement as HTMLElement;
		// Hidden altogether below a wide screen: nothing comes first on a phone.
		expect(sideBox.className).toContain("hidden");
		expect(sideBox.className).toContain("lg:block");
		expect(text.compareDocumentPosition(sideBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("is just text on a page on a phone: no contents list at all, since there is no room for one", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		expect(container.querySelector("details")).toBeNull();
		expect(screen.queryByText("Contents")).toBeNull();
		// The only contents is the one down the right of a wide screen, and it is hidden below that.
		const side = screen.getByRole("navigation", { name: "On this page" });
		expect(side.className).toContain("hidden");
		expect(side.className).toContain("lg:block");
		expect(screen.queryByRole("navigation", { name: "Contents" })).toBeNull();
	});

	it("gives the text the whole width on a phone: no counter, no numbers in the margin, no indent, and bigger type", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		// The pinned counter and the numbers beside each clause are for a wide screen only (from 768 pixels).
		const pin = container.querySelector("[data-counter]")?.parentElement as HTMLElement;
		expect(pin.className).toContain("max-md:hidden");
		const number = container.querySelector("[data-clause-number]") as HTMLElement;
		expect(number.className).toContain("max-md:hidden");
		const row = number.parentElement as HTMLElement;
		expect(row.className).toContain("max-md:ml-0");
		expect(row.className).toContain("max-md:block");
		const heading = screen.getByRole("heading", { level: 2, name: "One" });
		expect(heading.className).toContain("max-md:pl-0");
		expect(heading.className).toContain("max-md:text-[1.5rem]");
		const list = screen.getByText("a").closest("ul") as HTMLElement;
		expect(list.className).toContain("max-md:ml-0");
		// The text itself is a size up on a phone, and the lead keeps its size.
		expect(screen.getByText("Alpha.").className).toContain("max-md:text-[18px]");
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

	it("opens a link that leaves the site in a new tab, without handing it this page, and leaves the site's own links alone", () => {
		render(
			<LegalPage
				authUrl={AUTH}
				doc={{
					...SMALL,
					intro: [
						[
							"See ",
							{ text: "the repository", href: "https://github.com/x" },
							" and ",
							{ text: "us", href: "/terms" },
							".",
						],
					],
				}}
			/>,
		);
		const outside = screen.getByRole("link", { name: "the repository" });
		expect(outside).toHaveAttribute("target", "_blank");
		expect(outside.getAttribute("rel")).toContain("noopener");
		expect(outside.getAttribute("rel")).toContain("noreferrer");
		expect(screen.getByRole("link", { name: "us" })).not.toHaveAttribute("target");
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
const linksOf = (doc: LegalDoc) => {
	const hrefs: string[] = [];
	const collect = (parts: (string | { text: string; href: string })[]) => {
		for (const part of parts) if (typeof part !== "string") hrefs.push(part.href);
	};
	for (const p of doc.intro ?? []) if (Array.isArray(p)) collect(p);
	for (const section of doc.sections)
		for (const block of section.body) if (Array.isArray(block)) collect(block);
	return hrefs;
};

// What is true of every legal document, however it is worded.
describe.each([
	["the terms of service", TERMS],
	["the privacy policy", PRIVACY],
	["the risk disclosure", RISK],
	["the acceptable use policy", ACCEPTABLE_USE],
	["the license", LICENSE],
	["the security disclosure", DISCLOSURE],
])("%s", (_name, doc) => {
	it("is dated, and only ever writes the way the site does: no long dashes, no placeholders, no AI wording, no shouting", () => {
		expect(doc.updated).toBe("October 9, 2026");
		const all = text(doc);
		expect(all).not.toMatch(
			new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
		);
		expect(all).not.toMatch(/\bTODO\b|\bTBD\b|\[[^\]]*\]|lorem|placeholder/i);
		expect(all).not.toMatch(/\bAI[- ]generated\b|written by an AI|ChatGPT|Claude/i);
		expect(all).not.toMatch(/!/);
	});

	it("never promises safety it cannot prove, or anything not built", () => {
		const all = text(doc);
		expect(all.replace(/not been independently audited/gi, "")).not.toMatch(/\baudited\b/i);
		// It may say money is NOT insured, which is true, and must never say that it is.
		expect(all.replace(/not (covered|insured)/gi, "")).not.toMatch(/\binsured\b|\bfdic\b/i);
		expect(all).not.toMatch(/risk.free|cannot lose|100% secure|military.grade|unhackable/i);
		// It may say there is NO open source license, which is the point of the license page, and must never say there is one.
		expect(all.replace(/no open source license/gi, "")).not.toMatch(/open source license/i);
	});

	it("reaches the company at legal@maschina.dev, and every address it links to inside the site is a page that exists", () => {
		const hrefs = linksOf(doc);
		expect(hrefs).toContain("mailto:legal@maschina.dev");
		expect(text(doc)).toMatch(/legal@maschina\.dev/);
		for (const href of hrefs.filter((h) => h.startsWith("/")))
			expect(ROUTES[href], href).toBeDefined();
	});

	it("names who runs it, and nobody else's address as its own", () => {
		expect(text(doc)).toMatch(/Maschina Labs/);
		expect(text(doc)).not.toMatch(/info@|asher@/);
	});
});

describe("the terms of service", () => {
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

	it("never promises a result, and says plainly that money can be lost and that this is not advice", () => {
		const all = text(TERMS);
		expect(all).not.toMatch(/guarantee(s|d)? (profit|returns|that you will)/i);
		expect(all).toMatch(/can lose (some or all|money)/i);
		expect(all).toMatch(/not financial advice|does not give financial advice|not .*adviser/i);
		expect(all).toMatch(/source.available/i);
	});

	it("points to the other legal pages by their real addresses, and says where the law is", () => {
		const hrefs = linksOf(TERMS);
		for (const href of ["/privacy", "/risk", "/license", "/disclosure"])
			expect(hrefs).toContain(href);
		expect(text(TERMS)).toMatch(/Alberta/);
		expect(text(TERMS)).toMatch(/18/);
	});
});

describe("the privacy policy", () => {
	it("covers what a privacy policy has to cover", () => {
		const headings = PRIVACY.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/who we are/i,
			/what we collect/i,
			/what we do not collect/i,
			/how we use/i,
			/permanent record/i,
			/cookies/i,
			/who else sees/i,
			/ai providers/i,
			/where it is processed/i,
			/how long/i,
			/protect/i,
			/rights/i,
			/children/i,
			/changes/i,
			/contact/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("says honestly what cannot be deleted, who gets the information, and what is not done with it", () => {
		const all = text(PRIVACY);
		// The record that cannot be rewritten and the chain that cannot be erased limit deletion, and it says so.
		expect(all).toMatch(/cannot delete or edit a machine's record/i);
		expect(all).toMatch(/Solana network are public and permanent/i);
		expect(all).toMatch(/do not sell your information/i);
		expect(all).toMatch(/do not run advertising/i);
		expect(all).toMatch(/do not currently use analytics/i);
		expect(all).toMatch(/private keys of your own wallet/i);
		// The services that receive information are named, not hidden.
		for (const name of ["Cloudflare", "Telegram"]) expect(all).toContain(name);
	});

	it("describes only the cookies there are: the sign in cookie and the one that remembers the choice", () => {
		const cookies = PRIVACY.sections.find((section) => /cookies/i.test(section.heading));
		const words = (cookies?.body ?? [])
			.map((block) => (typeof block === "string" ? block : ""))
			.join(" ");
		expect(words).toMatch(/sign in cookie/i);
		expect(words).toMatch(/Preferences/);
		expect(words).not.toMatch(/advertis|tracking|analytics/i);
	});

	it("links the terms of service and the security disclosure by their real addresses", () => {
		const hrefs = linksOf(PRIVACY);
		expect(hrefs).toContain("/terms");
		expect(hrefs).toContain("/disclosure");
	});
});

describe("the risk disclosure", () => {
	it("covers the risks of a product like this, each under its own heading", () => {
		const headings = RISK.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/what maschina is/i,
			/lose everything/i,
			/market risks/i,
			/machine and automation/i,
			/ai risks/i,
			/limits/i,
			/wallet and technical/i,
			/third parties/i,
			/legal and tax/i,
			/results and examples/i,
			/less risk/i,
			/your decision/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("says plainly that all of it can be lost, that nothing is insured, that limits do not make a machine safe, and that nothing is promised", () => {
		const all = text(RISK);
		expect(all).toMatch(/lose all of the money/i);
		expect(all).toMatch(/not insured/i);
		expect(all).toMatch(/not (a )?(bank|broker)|not a bank/i);
		expect(all).toMatch(/do not make it safe/i);
		expect(all).toMatch(/cannot be reversed|cannot be undone/i);
		expect(all).toMatch(/not been independently audited/i);
		expect(all).toMatch(/do not predict future results/i);
		expect(all).toMatch(/do not promise or imply that any machine will make money/i);
		expect(all).toMatch(/only use money you can afford to lose|money you can afford to lose/i);
	});

	it("shows no figures: no percentages, no amounts, no returns", () => {
		const all = text(RISK);
		expect(all).not.toMatch(/%|\$\d|\d+x\b|per cent|percent/i);
	});

	it("points to the terms by their real address, and reaches the company at the legal address", () => {
		const hrefs = linksOf(RISK);
		expect(hrefs).toContain("/terms");
		expect(hrefs).toContain("mailto:legal@maschina.dev");
	});
});

describe("the acceptable use policy", () => {
	it("covers what may not be done, each under its own heading", () => {
		const headings = ACCEPTABLE_USE.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/why this exists/i,
			/illegal activity/i,
			/markets and trading/i,
			/what a machine must not do/i,
			/security/i,
			/accounts and identity/i,
			/manager/i,
			/other people's rights/i,
			/what we may do/i,
			/reporting abuse/i,
			/contact/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("names the conduct that is barred, and says that ordinary fast trading is allowed", () => {
		const all = text(ACCEPTABLE_USE);
		for (const word of [
			/sanctions/i,
			/money laundering|launder/i,
			/wash trading/i,
			/spoofing/i,
			/pump and dump/i,
			/rug pull/i,
			/phish/i,
			/denial of service/i,
		])
			expect(all).toMatch(word);
		expect(all).toMatch(
			/ordinary trading, including trading that is fast, frequent or automated, is allowed/i,
		);
	});

	it("is honest about enforcement: it may act, it is not required to watch, and withdrawals stay possible", () => {
		const all = text(ACCEPTABLE_USE);
		expect(all).toMatch(/not required to watch/i);
		expect(all).toMatch(/pause or stop one machine/i);
		expect(all).toMatch(/should still be able to withdraw/i);
		expect(all).not.toMatch(/we (monitor|watch|review) (all|every)/i);
	});

	it("sends abuse reports to the abuse address and security problems to the disclosure page, and ties itself to the terms", () => {
		const hrefs = linksOf(ACCEPTABLE_USE);
		expect(hrefs).toContain("mailto:abuse@maschina.dev");
		expect(hrefs).toContain("/disclosure");
		expect(hrefs).toContain("/terms");
	});
});

describe("the license", () => {
	it("says what the repository's own notice says: public to be read, all rights reserved, not open source", () => {
		const all = text(LICENSE);
		expect(all).toMatch(/source.available, which is not the same as open source/i);
		expect(all).toMatch(/all rights are reserved/i);
		expect(all).toMatch(/There is no open source license/i);
		expect(all).toMatch(/not accepting outside contributions/i);
		expect(all).toMatch(/Söhne/);
	});

	it("grants nothing it does not mean to: no open source license is named as applying, and permission is only ever in writing", () => {
		const all = text(LICENSE);
		expect(all).not.toMatch(
			/\b(MIT|Apache|GPL|BSD|MPL|AGPL|Creative Commons|BUSL|Business Source)\b/,
		);
		expect(all).toMatch(/in writing/i);
		expect(all).toMatch(/Silence is not permission/i);
	});

	it("covers each part of a license page, under its own heading", () => {
		const headings = LICENSE.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/what this is/i,
			/what you may do/i,
			/what you may not do/i,
			/permission/i,
			/contributions/i,
			/third party/i,
			/names and logos/i,
			/warranty/i,
			/may change/i,
			/contact/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("points to the terms and the brand assets by their real addresses", () => {
		const hrefs = linksOf(LICENSE);
		expect(hrefs).toContain("/terms");
		expect(hrefs).toContain("/brand");
	});
});

describe("the security disclosure", () => {
	it("covers what a disclosure page has to cover, each under its own heading", () => {
		const headings = DISCLOSURE.sections.map((section) => section.heading);
		for (const needed of [
			/short version/i,
			/how to report/i,
			/what to include/i,
			/what happens next/i,
			/what matters most/i,
			/out of scope/i,
			/test safely/i,
			/promise/i,
			/rewards/i,
			/supported versions/i,
			/contact/i,
		])
			expect(
				headings.some((heading) => needed.test(heading)),
				String(needed),
			).toBe(true);
	});

	it("says what the repository's own security file says: report privately through GitHub, a reply in three days, the five things that matter most, the latest release only", () => {
		const all = text(DISCLOSURE);
		const hrefs = linksOf(DISCLOSURE);
		expect(hrefs).toContain("https://github.com/maschina-labs/maschina/security/advisories/new");
		expect(all).toMatch(/reply within three days/i);
		for (const matter of [
			/anywhere other than its owner's wallet/i,
			/beyond a machine's budget or its limits/i,
			/act as another user or another machine/i,
			/read or change the permanent record/i,
			/secret or key that could leave/i,
		])
			expect(all).toMatch(matter);
		expect(all).toMatch(/Only the latest release is supported/i);
	});

	it("sends reports to the security address and offers no reward it does not have", () => {
		const hrefs = linksOf(DISCLOSURE);
		expect(hrefs).toContain("mailto:security@maschina.dev");
		const all = text(DISCLOSURE);
		expect(all).toMatch(/do not run a bug bounty/i);
		expect(all).not.toMatch(/\$\d|reward of|we will pay|bounty of|up to \d/i);
	});

	it("gives a researcher rules to follow and a good faith promise, and does not promise a fix date", () => {
		const all = text(DISCLOSURE);
		expect(all).toMatch(/Use only your own accounts, your own wallets and your own funds/i);
		expect(all).toMatch(
			/Do not look at, take, change or delete anyone else's information or funds/i,
		);
		expect(all).toMatch(/will not take legal action against you/i);
		expect(all).toMatch(/cannot promise how long a fix will take/i);
		expect(all).not.toMatch(/within \d+ days of|90 days|fixed within/i);
	});
});
