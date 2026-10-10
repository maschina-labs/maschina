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
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
			expect(screen.getByRole("main").querySelectorAll("section")).toHaveLength(0);
			view.unmount();
		}
	});

	it("shows the front page at the root, and for any address that has no page", () => {
		for (const path of ["/", "/docs", "/anything/else", "/sign-in"]) {
			const view = render(<App authUrl={AUTH} path={path} />);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
				"The operating system for autonomous capital.",
			);
			view.unmount();
		}
	});
});
