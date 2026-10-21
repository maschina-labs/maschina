import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app.tsx";
import { DOC_PAGES } from "./docs/catalog.ts";

describe("the docs reading frame", () => {
	for (const [path, name] of Object.entries({
		"/docs": "Documentation",
		"/docs/quickstart": "Run your first machine.",
		"/docs/api": "API",
		"/docs/sdk": "SDK",
		"/docs/machine-spec": "Machine Spec",
		"/docs/templates": "Templates",
		"/docs/examples": "Examples",
	})) {
		it(`opens ${path} with a complete sidebar and article`, () => {
			render(<App authUrl="https://app.maschina.dev" path={path} />);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(name);
			const nav = screen.getByRole("navigation", { name: "Docs" });
			for (const href of [
				"/docs",
				"/docs/quickstart",
				"/docs/api",
				"/docs/sdk",
				"/docs/machine-spec",
				"/docs/templates",
				"/docs/examples",
			]) {
				expect(
					within(nav)
						.getAllByRole("link")
						.find((link) => link.getAttribute("href") === href),
				).toBeDefined();
			}
			expect(screen.getByRole("main").textContent?.length).toBeGreaterThan(500);
			const contents = screen.getByRole("navigation", { name: "On this page" });
			for (const link of within(contents).getAllByRole("link")) {
				const target = document.getElementById((link.getAttribute("href") ?? "").slice(1));
				expect(target?.tagName).toBe("H2");
				expect(target).toHaveTextContent(link.textContent ?? "");
			}
			for (const link of within(screen.getByRole("main")).getAllByRole("link")) {
				const href = link.getAttribute("href") ?? "";
				if (!href.startsWith("/docs")) continue;
				const [path, anchor] = href.split("#");
				const destination = DOC_PAGES.find((page) => page.path === path);
				expect(destination, href).toBeDefined();
				if (anchor)
					expect(
						destination?.headings.some((heading) => heading.id === anchor),
						href,
					).toBe(true);
			}
		});
	}
	it("exposes an expandable vertical navigation on small screens", () => {
		render(<App authUrl="https://app.maschina.dev" path="/docs" />);
		const button = screen.getByRole("button", { name: "Browse documentation" });
		expect(button).toHaveAttribute("aria-expanded", "false");
		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		expect(document.getElementById(button.getAttribute("aria-controls") ?? "")).toContainElement(
			screen.getByRole("navigation", { name: "Docs" }),
		);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(button).toHaveFocus();
	});
	it("describes the wallet requirement without recommending a provider", () => {
		render(<App authUrl="https://app.maschina.dev" path="/docs/quickstart" />);
		expect(screen.getByRole("main")).toHaveTextContent(
			"A compatible Solana wallet of your choice.",
		);
		expect(screen.getByRole("main")).not.toHaveTextContent(/Phantom/i);
	});
	it("keeps the existing guide inside a navigable docs layout", () => {
		render(<App authUrl="https://app.maschina.dev" path="/docs/quickstart" />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Run your first machine.");
		expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
			"href",
			"#docs-content",
		);
		expect(
			within(screen.getByRole("navigation", { name: "Docs" })).getByRole("link", {
				name: "Quickstart",
			}),
		).toHaveAttribute("aria-current", "page");
		const contents = screen.getByRole("navigation", { name: "On this page" });
		const link = within(contents).getByRole("link", { name: "What you need" });
		expect(document.getElementById((link.getAttribute("href") ?? "").slice(1))).toHaveTextContent(
			"What you need",
		);
	});

	it("filters section links without removing the guide", () => {
		render(<App authUrl="https://app.maschina.dev" path="/docs/quickstart" />);
		fireEvent.change(screen.getByRole("searchbox"), { target: { value: "what you need" } });
		const results = screen.getByRole("navigation", { name: "Search results" });
		expect(within(results).getAllByRole("link")).toHaveLength(1);
		expect(screen.getByRole("main")).toHaveTextContent("1. Sign in");
	});
});
