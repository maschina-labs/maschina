import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Features } from "./features.tsx";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
// Each section has its own kind of background, so no two neighbors look alike.
const FEATURES = [
	["portfolio", "See the whole portfolio at a glance.", "mesh"],
	["decisions", "Every decision is written down.", "particles"],
	["manager", "Ask your manager.", "ribbon"],
	["machines", "Make it yours.", "mesh"],
] as const;

const articles = () =>
	within(screen.getByRole("region", { name: "Inside the app" })).getAllByRole("article");

describe("the feature sections", () => {
	it("explains four screens of the app, one full page each, in this order", () => {
		render(<Features />);
		expect(articles()).toHaveLength(4);
		for (const [index, [name, title]] of FEATURES.entries()) {
			const article = articles()[index] as HTMLElement;
			expect(within(article).getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
			expect(within(article).getByRole("img")).toHaveAttribute(
				"src",
				`/showcase/feature-${name}.jpg`,
			);
			expect(existsSync(resolve(publicDir, "showcase", `feature-${name}.jpg`))).toBe(true);
			expect(article.className).toContain("min-h-dvh");
			expect(article.className).toContain("overflow-hidden");
		}
	});

	it("gives each section its own kind of background, drawn behind everything and hidden from assistive technology", () => {
		render(<Features />);
		for (const [index, [, , kind]] of FEATURES.entries()) {
			const article = articles()[index] as HTMLElement;
			const background = article.querySelector("[data-background]") as HTMLElement;
			expect(background).toHaveAttribute("data-background", kind);
			expect(background).toHaveAttribute("aria-hidden", "true");
			expect(background.className).toContain("pointer-events-none");
			expect(background.className).toContain("absolute");
		}
		const kinds = FEATURES.map(([, , kind]) => kind);
		for (const [index, kind] of kinds.entries()) expect(kinds[index + 1]).not.toBe(kind);
	});

	it("says each thing in a heading and one short gray line, with the words alternating left and centered", () => {
		render(<Features />);
		for (const [index, article] of articles().entries()) {
			expect(article.querySelectorAll("p")).toHaveLength(1);
			expect((article.querySelector("p")?.textContent ?? "").length).toBeLessThanOrEqual(160);
			expect(article.querySelector("p")?.className).toContain("text-neutral-400");
			expect(article.querySelectorAll("a, button, svg, [data-marker]")).toHaveLength(0);
			const words = article.querySelector("h3")?.parentElement as HTMLElement;
			expect(words.className).toContain(index % 2 === 0 ? "text-left" : "text-center");
		}
	});

	it("is honest that rearranging your own screens is coming, and claims nothing that is not built", () => {
		render(<Features />);
		const text = articles()[3]?.textContent ?? "";
		expect(text).toMatch(/coming soon/i);
		expect(text).not.toMatch(/\bany\b|unlimited|anything you/i);
	});

	it("shows each whole screen, uncropped, as large as the page allows, with its size declared and no panel or outline", () => {
		const { container } = render(<Features />);
		for (const image of screen.getAllByRole("img")) {
			expect(image).toHaveAttribute("loading", "lazy");
			expect(image).toHaveAttribute("decoding", "async");
			expect(image).toHaveAttribute("fetchpriority", "low");
			expect(image).toHaveAttribute("width", "2400");
			expect(image).toHaveAttribute("height", "1500");
			expect(image.getAttribute("alt")).toMatch(/screen of the Maschina app/);
			expect(image.className).toContain("w-full");
			expect(image.className).not.toMatch(/border|outline|ring|object-cover/);
			expect(image.className).toMatch(/shadow-\[[^\]]*oklch\(0_0_0\/0\.\d+\)\]/);
		}
		expect(container.innerHTML).not.toMatch(/bg-white\/\[0\.04\]|rounded/);
	});

	it("sits on black between the page margins, still apart from the backgrounds, naming no vendor or partner", () => {
		const { container } = render(<Features />);
		const { className } = screen.getByRole("region", { name: "Inside the app" });
		expect(className).toContain("bg-black");
		expect(container.innerHTML).not.toMatch(/transition-|hover:/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});

	it("starts the ribbon only when its section is near the screen, never while the page opens", () => {
		// jsdom has no way to say what is on screen, so nothing that draws may start.
		const { container } = render(<Features />);
		// The only canvas is the particles'; the ribbon's WebGL one is not there.
		const canvases = container.querySelectorAll("canvas");
		expect(canvases).toHaveLength(1);
		expect(canvases[0]?.closest("[data-background]")).toHaveAttribute(
			"data-background",
			"particles",
		);
	});
});
