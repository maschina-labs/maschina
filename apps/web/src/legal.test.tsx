import { fireEvent, render, screen, within } from "@testing-library/react";
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

	it("keeps the page margins on the article and the width on a box inside it, so the margins never squeeze the text", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const article = screen.getByRole("main").querySelector("article") as HTMLElement;
		expect(article.className).toContain("px-(--gutter)");
		expect(article.className).not.toMatch(/max-w-/);
		const column = article.firstElementChild as HTMLElement;
		expect(column).toHaveAttribute("data-column");
		expect(column.className).toContain("mx-auto");
		expect(column.className).toContain("max-w-[72rem]");
		expect(column.className).not.toContain("px-");
	});

	it("puts the contents down the left on a wide screen, held in view while the text is read, and the text in a reading column on the right", () => {
		const { container } = render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const layout = container.querySelector("[data-layout]") as HTMLElement;
		expect(layout.className).toContain("lg:grid-cols-[15rem_minmax(0,1fr)]");
		const side = screen.getByRole("navigation", { name: "On this page" });
		expect(side.className).toContain("lg:sticky");
		expect(side.className).toContain("lg:top-28");
		const links = within(side).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["1One", "2Two"]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["#one", "#two"]);
		const text = container.querySelector("[data-text]") as HTMLElement;
		expect(text.className).toContain("max-w-[42rem]");
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

	it("numbers every section and every clause the way a contract does, so any part can be pointed to", () => {
		render(<LegalPage authUrl={AUTH} doc={SMALL} />);
		const one = screen.getByRole("heading", { level: 2, name: "One" });
		expect(one).toHaveAttribute("id", "one");
		expect(one.className).toContain("font-medium");
		expect(within(one).getByText("1")).toHaveAttribute("aria-hidden", "true");
		// Clauses 1.1 and 1.2 are the two paragraphs; the list belongs to the one before it and is not numbered.
		expect(screen.getByText("Alpha.").closest("div")).toHaveTextContent("1.1Alpha.");
		expect(screen.getByText("Beta.").closest("div")).toHaveTextContent("1.2Beta.");
		expect(screen.getByText("Gamma.").closest("div")).toHaveTextContent("2.1Gamma.");
		const list = screen.getByText("a").closest("ul") as HTMLElement;
		expect(list.className).toContain("list-[square]");
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
