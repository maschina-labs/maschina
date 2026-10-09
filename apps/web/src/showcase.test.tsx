import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
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

	it("is a plain, static picture: no video, no canvas, no animation, no tilt, nothing that moves with the scroll", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("video, canvas, iframe")).toBeNull();
		expect(container.querySelector("[data-tilt]")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-|perspective|rotate|will-change/);
	});

	it("sits centered in a backdrop of its own: a wide panel of soft pearl, violet and silver-blue light, with room all around", () => {
		const { container } = render(<Showcase />);
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).not.toBeNull();
		expect(backdrop.contains(screen.getByRole("img"))).toBe(true);
		// Layers of soft light, not a flat fill: three radial lights over a base.
		expect(backdrop.className.match(/radial-gradient\(/g)).toHaveLength(3);
		expect(backdrop.className).toContain("oklch(0.86_0.07_300)");
		expect(backdrop.className).toContain("oklch(0.8_0.06_235)");
		// Room around the picture, growing with the screen, so it floats in the middle.
		expect(backdrop.className).toContain("p-[clamp(1.25rem,7vw,7rem)]");
		expect(backdrop.className).toContain("overflow-hidden");
		expect(backdrop.className).not.toMatch(/rounded/);
	});

	it("has a fine grain over the backdrop, drawn by the browser: no image file, no graphics card", () => {
		const { container } = render(<Showcase />);
		const grain = container.querySelector("[data-grain]") as HTMLElement;
		expect(grain).toHaveAttribute("aria-hidden", "true");
		expect(grain.className).toContain("pointer-events-none");
		expect(grain.className).toContain("absolute");
		expect(grain.style.backgroundImage).toContain("feTurbulence");
	});

	it("lifts the picture off the backdrop with an ordinary dark drop shadow, not a glow", () => {
		render(<Showcase />);
		const { className } = screen.getByRole("img");
		expect(className).toMatch(/shadow-\[[^\]]*oklch\(0_0_0\/0\.\d+\)\]/);
		expect(className).toContain("relative");
	});

	it("fills the width between the page margins, on black, with square corners", () => {
		const { container } = render(<Showcase />);
		const { className } = screen.getByRole("region", { name: "The app" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
