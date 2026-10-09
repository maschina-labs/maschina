import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Features } from "./features.tsx";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const FEATURES = [
	["portfolio", "See the whole portfolio at a glance."],
	["decisions", "Every decision is written down."],
	["activity", "Everything it does, in order."],
	["insights", "Know how it is really doing."],
	["manager", "Ask your manager."],
] as const;

const articles = () =>
	within(screen.getByRole("region", { name: "Inside the app" })).getAllByRole("article");

describe("the feature sections", () => {
	it("explains five screens of the app, one section each, in this order", () => {
		render(<Features />);
		expect(articles()).toHaveLength(5);
		for (const [index, [name, title]] of FEATURES.entries()) {
			const article = articles()[index] as HTMLElement;
			expect(within(article).getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
			expect(within(article).getByRole("img")).toHaveAttribute(
				"src",
				`/showcase/feature-${name}.jpg`,
			);
			expect(existsSync(resolve(publicDir, "showcase", `feature-${name}.jpg`))).toBe(true);
		}
	});

	it("says each thing in a heading and one short gray line, nothing more", () => {
		render(<Features />);
		for (const article of articles()) {
			expect(article.querySelectorAll("p")).toHaveLength(1);
			expect((article.querySelector("p")?.textContent ?? "").length).toBeLessThanOrEqual(160);
			expect(article.querySelector("p")?.className).toContain("text-neutral-400");
			expect(article.querySelectorAll("a, button, svg, [data-marker]")).toHaveLength(0);
		}
	});

	it("shows each screen large, beside its text on a wide screen, and swaps sides every other section", () => {
		render(<Features />);
		for (const [index, article] of articles().entries()) {
			// The wide column always belongs to the picture, whichever side it is on.
			expect(article.className).toContain(
				index % 2 === 0
					? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
					: "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
			);
			const picture = within(article).getByRole("img").parentElement as HTMLElement;
			expect(picture.className).toContain(index % 2 === 0 ? "lg:order-2" : "lg:order-1");
		}
	});

	it("loads the pictures only as you near them, with their size declared", () => {
		render(<Features />);
		for (const image of screen.getAllByRole("img")) {
			expect(image).toHaveAttribute("loading", "lazy");
			expect(image).toHaveAttribute("decoding", "async");
			expect(image).toHaveAttribute("fetchpriority", "low");
			expect(image).toHaveAttribute("width", "2400");
			expect(image).toHaveAttribute("height", "1500");
			expect(image.getAttribute("alt")).toMatch(/screen of the Maschina app/);
		}
	});

	it("is square and still on black, with each picture running to the edge of its panel and no outline", () => {
		const { container } = render(<Features />);
		const { className } = screen.getByRole("region", { name: "Inside the app" });
		expect(className).toContain("bg-black");
		expect(className).toContain("px-(--gutter)");
		for (const image of screen.getAllByRole("img"))
			expect(image.className).not.toMatch(/border|outline|ring/);
		expect(container.innerHTML).not.toMatch(/rounded|animate-|transition-|hover:/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
