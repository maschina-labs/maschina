import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Mosaic } from "./mosaic.tsx";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const TILES = ["Portfolio", "Decisions", "Activity", "Insights", "Manager"] as const;

const figures = () =>
	within(screen.getByRole("region", { name: "Inside the app" })).getAllByRole("figure");

describe("the mosaic of the app's screens", () => {
	it("has a short centered title in the pearl gradient and thin outline, like the questions", () => {
		render(<Mosaic />);
		const heading = screen.getByRole("heading", { level: 2, name: "Everything in one place." });
		expect(heading.className).toContain("text-center");
		expect(heading.className).toContain("bg-clip-text");
		expect(heading.className).toContain("[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]");
		expect(heading.className).toContain("pb-[0.14em]");
		expect(heading.className).toContain("-mb-[0.14em]");
	});

	it("sits on the same pearl and silver backdrop as the dashboard image, so the dark tiles stand out from the black", () => {
		const { container } = render(<Mosaic />);
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).not.toBeNull();
		expect(backdrop.contains(figures()[0] as HTMLElement)).toBe(true);
		expect(backdrop.className).toContain("oklch(0.9_0.02_300)");
		expect(backdrop.className).toContain("p-[clamp(1.25rem,7vw,7rem)]");
		expect(backdrop.querySelector("[data-grain]")).not.toBeNull();
		// Each tile lifts off the light with an ordinary dark shadow, not a glow.
		for (const figure of figures()) {
			expect(figure.className).toMatch(/shadow-\[[^\]]*oklch\(0_0_0\/0\.\d+\)\]/);
		}
	});

	it("shows five real screens of the app, each a figure with the screen's name on it, in this order", () => {
		render(<Mosaic />);
		expect(figures()).toHaveLength(5);
		for (const [index, name] of TILES.entries()) {
			const figure = figures()[index] as HTMLElement;
			expect(within(figure).getByText(name).tagName).toBe("FIGCAPTION");
			const image = within(figure).getByRole("img");
			expect(image).toHaveAttribute("src", `/showcase/mosaic-${name.toLowerCase()}.jpg`);
			expect(existsSync(resolve(publicDir, "showcase", `mosaic-${name.toLowerCase()}.jpg`))).toBe(
				true,
			);
			expect(image.getAttribute("alt")).toMatch(new RegExp(`${name}`, "i"));
		}
	});

	it("makes the first screen one big tile and the other four small ones beside it, in a grid of equal-shaped tiles", () => {
		render(<Mosaic />);
		const grid = figures()[0]?.parentElement as HTMLElement;
		expect(grid.className).toContain("grid");
		expect(grid.className).toContain("grid-cols-2");
		expect(grid.className).toContain("lg:grid-cols-4");
		expect(grid.className).toContain("gap-3");
		expect(figures()[0]?.className).toContain("col-span-2");
		expect(figures()[0]?.className).toContain("row-span-2");
		for (const figure of figures().slice(1)) {
			expect(figure.className).toContain("aspect-[16/10]");
			expect(figure.className).not.toContain("col-span-2");
		}
	});

	it("puts each name bottom left over a soft dark fade so it reads, with nothing else added: no dots, no chips, no icons", () => {
		render(<Mosaic />);
		for (const figure of figures()) {
			const caption = figure.querySelector("figcaption") as HTMLElement;
			expect(caption.className).toContain("absolute");
			expect(caption.className).toContain("bottom-0");
			expect(caption.className).toContain("bg-gradient-to-t");
			expect(caption.className).toContain("text-white");
			expect(figure.querySelectorAll("svg, [data-marker], [data-chip], button, a")).toHaveLength(0);
		}
	});

	it("loads the pictures only as you near them, since they are large and sit below the first screen", () => {
		render(<Mosaic />);
		for (const image of screen.getAllByRole("img")) {
			expect(image).toHaveAttribute("loading", "lazy");
			expect(image).toHaveAttribute("decoding", "async");
			expect(image).toHaveAttribute("fetchpriority", "low");
			expect(image).toHaveAttribute("width");
			expect(image).toHaveAttribute("height");
			expect(image.className).toContain("object-cover");
		}
	});

	it("says plainly, once, under the grid, that it is sample data, centered", () => {
		render(<Mosaic />);
		const caption = screen.getByText("The Maschina app, shown with sample data.");
		expect(caption.className).toContain("text-center");
		expect(caption.tagName).toBe("P");
	});

	it("is a still section on black between the page margins, square, and names no vendor and no partner", () => {
		const { container } = render(<Mosaic />);
		const { className } = screen.getByRole("region", { name: "Inside the app" });
		expect(className).toContain("bg-black");
		expect(className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded|animate-|transition-|hover:/);
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
