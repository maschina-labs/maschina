import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.tsx";
import { ROUTES } from "./routes.ts";

const AUTH = "https://auth.maschina.dev";

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
			if (path === "/terms" || path === "/privacy") continue;
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
});
