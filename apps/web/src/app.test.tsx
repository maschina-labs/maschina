import { render, screen } from "@testing-library/react";
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
	"/news": 1,
	"/contact": 1,
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});

describe("which page an address shows", () => {
	it("shows a blank page named for the address, with or without a trailing slash", () => {
		const first = render(<App authUrl={AUTH} path="/papers" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Papers");
		first.unmount();
		render(<App authUrl={AUTH} path="/papers/" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Papers");
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

	it("shows the front page at the root, and for any address that has no page", () => {
		for (const path of ["/", "/anything/else", "/sign-in"]) {
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
				"The operating system for autonomous capital.",
			);
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

	it("shows the news page at /news, as an article", () => {
		render(<App authUrl={AUTH} path="/news" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("News from Maschina Labs");
	});

	it("shows the contact form at /contact", () => {
		render(<App authUrl={AUTH} path="/contact" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contact");
		expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
	});
});
