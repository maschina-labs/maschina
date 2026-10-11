import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PAGES, Site } from "./site.tsx";

describe("the docs pages", () => {
	it("has a page for every address the site and its menus send people to", () => {
		expect(PAGES.map((page) => page.path)).toEqual([
			"/",
			"/quickstart",
			"/api",
			"/sdk",
			"/machine-spec",
			"/templates",
			"/examples",
		]);
	});

	it.each(PAGES)(
		"$path is a blank black page named $name, and the tab says so",
		({ path, name }) => {
			render(<Site path={path} />);
			const page = screen.getByRole("main", { name });
			expect(page).toBeEmptyDOMElement();
			expect(page.className).toContain("bg-black");
			expect(document.title).toBe(`${name} | Maschina`);
		},
	);

	it("says there is no page, plainly, for any other address, and does not index it", () => {
		render(<Site path="/nothing-here" />);
		expect(screen.getByRole("main", { name: "Page Not Found" })).toBeInTheDocument();
		expect(document.title).toBe("Page Not Found | Maschina");
	});

	it("ignores a trailing slash", () => {
		render(<Site path="/sdk/" />);
		expect(document.title).toBe("SDK | Maschina");
	});
});
