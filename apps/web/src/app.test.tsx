import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.tsx";
import { ROUTES } from "./routes.ts";

const AUTH = "https://auth.maschina.dev";
const LEGAL = {
	"/terms": 1,
	"/privacy": 1,
	"/risk": 1,
	"/acceptable-use": 1,
	"/license": 1,
	"/disclosure": 1,
	"/about": 1,
	"/roadmap": 1,
	"/support": 1,
	"/brand": 1,
	"/papers": 1,
	"/contact": 1,
	"/product": 1,
	"/how-it-works": 1,
	"/machines": 1,
	"/security": 1,
	"/docs": 1,
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});

describe("which page an address shows", () => {
	it("shows a blank page named for the address, with or without a trailing slash", () => {
		const first = render(<App authUrl={AUTH} path="/pricing" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pricing");
		first.unmount();
		render(<App authUrl={AUTH} path="/pricing/" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pricing");
	});

	it("shows a blank page for every address in the table", () => {
		for (const [path, title] of Object.entries(ROUTES)) {
			// The legal pages are written out in full; the rest are blank.
			if (path in LEGAL) continue;
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
			expect(screen.getByRole("main").querySelectorAll("section")).toHaveLength(0);
			view.unmount();
		}
	});

	it("shows the front page at the root", () => {
		render(<App authUrl={AUTH} path="/" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"The operating system for autonomous capital.",
		);
	});

	it("says there is no page, plainly, for an address that has none, with a way home, and the sign in addresses are among them", () => {
		for (const path of ["/anything/else", "/sign-in", "/papers/extra"]) {
			const view = render(<App authUrl={AUTH} path={path} />);
			const main = within(screen.getByRole("main"));
			expect(main.getByRole("heading", { level: 1 })).toHaveTextContent("Page Not Found");
			expect(main.getByRole("link", { name: "Go to the front page" })).toHaveAttribute("href", "/");
			expect(document.title).toBe("Page Not Found | Maschina");
			view.unmount();
		}
	});
});

describe("the legal pages", () => {
	it("shows the terms of service at /terms, as a real document and not a blank page", () => {
		render(<App authUrl={AUTH} path="/terms" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terms of Service");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(10);
	});

	it("shows the privacy policy at /privacy, as a real document too", () => {
		render(<App authUrl={AUTH} path="/privacy" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy Policy");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(10);
	});

	it("shows the risk disclosure at /risk, as a real document too", () => {
		render(<App authUrl={AUTH} path="/risk" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Risk Disclosure");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(10);
	});

	it("shows the acceptable use policy at /acceptable-use, as a real document too", () => {
		render(<App authUrl={AUTH} path="/acceptable-use" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Acceptable Use Policy");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(10);
	});

	it("shows the license at /license, as a real document too", () => {
		render(<App authUrl={AUTH} path="/license" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("License");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(8);
	});

	it("shows the security disclosure at /disclosure, as a real document too", () => {
		render(<App authUrl={AUTH} path="/disclosure" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Security Disclosure");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(8);
	});

	it("shows the about page at /about, as an article", () => {
		render(<App authUrl={AUTH} path="/about" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Controls for AI");
		expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(2);
	});

	it("shows the roadmap at /roadmap, as an article", () => {
		render(<App authUrl={AUTH} path="/roadmap" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"What Maschina is building",
		);
		expect(screen.getByRole("heading", { level: 2, name: "Now" })).toBeInTheDocument();
	});

	it("shows the contact form at /contact", () => {
		render(<App authUrl={AUTH} path="/contact" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contact");
		expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
	});

	it("shows the support page at /support", () => {
		render(<App authUrl={AUTH} path="/support" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Support");
	});

	it("names each page's tab by its full page name, then a bar and Maschina; an article by its short name, not its headline", () => {
		for (const [path, tab] of [
			["/terms", "Terms of Service | Maschina"],
			["/privacy", "Privacy Policy | Maschina"],
			["/risk", "Risk Disclosure | Maschina"],
			["/about", "About | Maschina"],
			["/roadmap", "Roadmap | Maschina"],
			["/contact", "Contact | Maschina"],
			["/support", "Support | Maschina"],
			["/pricing", "Pricing | Maschina"],
		] as const) {
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(document.title, path).toBe(tab);
			view.unmount();
		}
	});

	it("shows the brand assets page at /brand", () => {
		render(<App authUrl={AUTH} path="/brand" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Brand Assets");
	});
});

describe("what a search engine is told about each page", () => {
	const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute("content");
	const canonical = () =>
		document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");

	it("points each page with something on it at its own address, and leaves it to be indexed", () => {
		for (const [path, href] of [
			["/", "https://maschina.dev/"],
			["/terms", "https://maschina.dev/terms"],
			["/about/", "https://maschina.dev/about"],
			["/brand", "https://maschina.dev/brand"],
		] as const) {
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(canonical(), path).toBe(href);
			expect(robots(), path).toBeUndefined();
			view.unmount();
		}
	});

	it("keeps a blank page and the not found page out of search results, and puts things back when they go", () => {
		for (const path of ["/pricing", "/nowhere"]) {
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(robots(), path).toBe("noindex");
			view.unmount();
			expect(robots(), path).toBeUndefined();
		}
	});

	it("shows the papers page at /papers, with a place for each video, deck and paper", () => {
		render(<App authUrl={AUTH} path="/papers" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Papers");
		expect(screen.getByRole("heading", { level: 2, name: "Videos" })).toBeInTheDocument();
	});
});

describe("the language of a page", () => {
	const html = document.documentElement;
	const alternates = () =>
		[...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((node) => [
			node.getAttribute("hreflang"),
			node.getAttribute("href"),
		]);

	it("sets the page's language and its reading direction, from the address, and puts them back when it goes", () => {
		html.lang = "en";
		html.dir = "ltr";
		const arabic = render(<App authUrl={AUTH} path="/ar/terms" available={["en", "es", "ar"]} />);
		expect(html.lang).toBe("ar");
		expect(html.dir).toBe("rtl");
		arabic.unmount();
		expect(html.lang).toBe("en");
		expect(html.dir).toBe("ltr");
		const spanish = render(<App authUrl={AUTH} path="/es" available={["en", "es"]} />);
		expect(html.lang).toBe("es");
		expect(html.dir).toBe("ltr");
		spanish.unmount();
		render(<App authUrl={AUTH} path="/terms" available={["en", "es"]} />);
		expect(html.lang).toBe("en");
	});

	it("shows the page the address names, with the language taken off it, so /es/terms is the terms", () => {
		render(<App authUrl={AUTH} path="/es/terms" available={["en", "es"]} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terms of Service");
	});

	it("reads a language that is not ready as English, and says so: the page and the tag are English", () => {
		html.lang = "en";
		render(<App authUrl={AUTH} path="/fr/terms" available={["en"]} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terms of Service");
		expect(html.lang).toBe("en");
	});

	it("points a translated page at its own address, and lists the same page in every ready language for search engines", () => {
		render(<App authUrl={AUTH} path="/es/terms" available={["en", "es", "ar"]} />);
		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
			"https://maschina.dev/es/terms",
		);
		expect(alternates()).toEqual([
			["en", "https://maschina.dev/terms"],
			["es", "https://maschina.dev/es/terms"],
			["ar", "https://maschina.dev/ar/terms"],
			["x-default", "https://maschina.dev/terms"],
		]);
	});

	it("lists no alternates while only English is ready, and takes them away when the page goes", () => {
		const view = render(<App authUrl={AUTH} path="/terms" available={["en"]} />);
		expect(alternates()).toEqual([]);
		view.unmount();
		const other = render(<App authUrl={AUTH} path="/terms" available={["en", "es"]} />);
		expect(alternates().length).toBe(3);
		other.unmount();
		expect(alternates()).toEqual([]);
	});
});
