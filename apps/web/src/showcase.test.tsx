import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Showcase } from "./showcase.tsx";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

describe("the showcase", () => {
	it("shows a real screenshot of the app, as one figure", () => {
		render(<Showcase />);
		const section = screen.getByRole("region", { name: "The app" });
		const figure = within(section).getByRole("figure");
		const image = within(figure).getByRole("img");
		expect(image).toHaveAttribute("src", "/showcase/dashboard.jpg");
		expect(existsSync(resolve(publicDir, "showcase/dashboard.jpg"))).toBe(true);
		// It says what is in it, for anyone who cannot see it.
		expect(image.getAttribute("alt")).toMatch(/home screen/);
		expect(image.getAttribute("alt")).toMatch(/chart/);
		// Its size is declared, so the page does not jump as it loads.
		expect(image).toHaveAttribute("width", "2624");
		expect(image).toHaveAttribute("height", "1640");
		expect(image).toHaveAttribute("decoding", "async");
	});

	it("says plainly that it is sample data", () => {
		render(<Showcase />);
		expect(screen.getByText("The Maschina app, shown with sample data.")).toBeInTheDocument();
	});

	it("is a plain, static picture: no video, no canvas, no animation", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("video, canvas, iframe")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-/);
	});

	it("has no border or frame around the picture, and no glow underneath it", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("[data-frame]")).toBeNull();
		expect(screen.getByRole("img").parentElement?.className ?? "").not.toMatch(
			/\bp-|border|ring|outline|bg-white/,
		);
		expect(container.innerHTML).not.toMatch(/shadow-/);
	});

	it("stands out by light instead: a soft spotlight behind the top of it, and a faint sheen across its top edge", () => {
		const { container } = render(<Showcase />);
		const spotlight = container.querySelector("[data-spotlight]") as HTMLElement;
		const sheen = container.querySelector("[data-sheen]") as HTMLElement;
		for (const layer of [spotlight, sheen]) {
			expect(layer).toHaveAttribute("aria-hidden", "true");
			expect(layer.className).toContain("pointer-events-none");
			expect(layer.className).toContain("absolute");
		}
		// The spotlight is behind, wide and low in strength, and starts at the top, so nothing glows below it.
		expect(spotlight.className).toContain("radial-gradient(ellipse");
		expect(spotlight.className).toContain("at_50%_0%");
		expect(spotlight.className).toContain("top-0");
		expect(spotlight.className).not.toContain("bottom-");
		expect(spotlight.className).toMatch(/oklch\([^)]*\/0\.(1|2)\d?\)/);
		// The sheen sits on the picture and is only on its top part.
		expect(sheen.className).toContain("bg-gradient-to-b");
		expect(sheen.className).toContain("from-white/[0.08]");
		expect(sheen.className).toContain("to-transparent");
		expect(sheen.parentElement).toBe(screen.getByRole("img").parentElement);
	});

	describe("the tilt", () => {
		const place = (top: number, height = 945) => {
			Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
			const tilt = document.querySelector("[data-tilt]") as HTMLElement;
			tilt.getBoundingClientRect = () => ({ top }) as DOMRect;
			fireEvent.scroll(window);
			return Number.parseFloat(tilt.style.getPropertyValue("--tilt"));
		};

		it("leans back while it is still below the fold, and lies flat once it has come into view", () => {
			render(<Showcase />);
			// Just entering at the bottom of the screen: fully leaned back.
			expect(place(945)).toBe(1);
			expect(place(2000)).toBe(1);
			// Well up the screen: flat.
			expect(place(945 * 0.15)).toBe(0);
			expect(place(0)).toBe(0);
			expect(place(-300)).toBe(0);
		});

		it("comes in smoothly in between, following the scroll", () => {
			render(<Showcase />);
			const halfway = place(945 * 0.15 + (945 * 0.85) / 2);
			expect(halfway).toBeCloseTo(0.5, 5);
			const nearer = place(945 * 0.4);
			expect(nearer).toBeLessThan(halfway);
			expect(nearer).toBeGreaterThan(0);
		});

		it("is a perspective tilt about the bottom edge, read from one variable, flat if the variable is missing", () => {
			render(<Showcase />);
			const tilt = document.querySelector("[data-tilt]") as HTMLElement;
			expect(tilt.className).toContain("perspective(");
			// A gentle lean: 6 degrees back at most, and 3% smaller.
			expect(tilt.className).toContain("rotateX(calc(var(--tilt)*6deg))");
			expect(tilt.className).toContain("scale(calc(1-var(--tilt)*0.03))");
			expect(tilt.className).toContain("origin-bottom");
			expect(tilt.className).toContain("[--tilt:0]");
		});

		it("does not tilt for anyone who asked for less motion", () => {
			const original = window.matchMedia;
			window.matchMedia = ((query: string) => ({
				matches: query.includes("reduce"),
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
				addListener: () => {},
				removeListener: () => {},
				onchange: null,
				dispatchEvent: () => false,
			})) as typeof window.matchMedia;
			render(<Showcase />);
			expect(place(2000)).toBeNaN();
			window.matchMedia = original;
		});
	});

	it("fills the width between the page margins, on black, with square corners", () => {
		const { container } = render(<Showcase />);
		const { className } = screen.getByRole("region", { name: "The app" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(screen.getByRole("img").className).toContain("w-full");
		expect(screen.getByRole("img").className).toContain("h-auto");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
