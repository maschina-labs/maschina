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
		expect(image).toHaveAttribute("width", "2838");
		expect(image).toHaveAttribute("height", "1800");
		expect(image).toHaveAttribute("decoding", "async");
		// It sits below the first screen, and is a very large picture: it is fetched and decoded only when the reader
		// is getting near it, so it never competes with the hero's animation while the page is opening.
		expect(image).toHaveAttribute("loading", "lazy");
		expect(image).toHaveAttribute("fetchpriority", "low");
	});

	it("opens with the section's title above the picture: short, centered, in the pearl gradient with the thin outline", () => {
		render(<Showcase />);
		const heading = screen.getByRole("heading", { level: 2, name: "Everything in one place." });
		const picture = screen.getByRole("img");
		expect(
			heading.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		for (const part of [
			"text-center",
			"bg-clip-text",
			"[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]",
			"pb-[0.14em]",
			"-mb-[0.14em]",
		])
			expect(heading.className).toContain(part);
	});

	it("says plainly that it is sample data, centered under the picture", () => {
		render(<Showcase />);
		const caption = screen.getByText("The Maschina app, shown with sample data.");
		expect(caption.tagName).toBe("FIGCAPTION");
		expect(caption.className).toContain("text-center");
	});

	it("is a plain, still picture: no video, no canvas, no tilt, no shine, nothing that moves with the scroll or the mouse", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("video, canvas, iframe")).toBeNull();
		expect(container.querySelector("[data-tilt], [data-shine], [data-picture]")).toBeNull();
		expect(container.innerHTML).not.toMatch(
			/animate-|will-change|perspective|rotate|--tx|--ty|transition-/,
		);
	});

	it("is very sharp: a 2838 pixel file for most screens and a 5676 pixel one for the densest, chosen by the browser", () => {
		render(<Showcase />);
		const image = screen.getByRole("img");
		expect(image).toHaveAttribute("src", "/showcase/dashboard.jpg");
		expect(image.getAttribute("srcset")).toBe(
			"/showcase/dashboard.jpg 2838w, /showcase/dashboard-4x.jpg 5676w",
		);
		// How wide it is shown: about 900 pixels on a laptop, 1300 on a very wide screen, and most of the width on a phone.
		expect(image.getAttribute("sizes")).toBe(
			"(min-width: 1536px) 1300px, (min-width: 1280px) 900px, 82vw",
		);
		for (const file of ["dashboard.jpg", "dashboard-4x.jpg"]) {
			expect(existsSync(resolve(publicDir, "showcase", file))).toBe(true);
		}
	});

	it("has no window frame or title bar around the picture: just the picture", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("[data-window], [data-titlebar], [data-control]")).toBeNull();
		expect(screen.getByRole("img").parentElement).toBe(container.querySelector("[data-backdrop]"));
	});

	it("sits centered in a backdrop of its own: a wide panel of soft pearl and silver light, with room all around", () => {
		const { container } = render(<Showcase />);
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).not.toBeNull();
		expect(backdrop).toHaveAttribute("data-tone", "pearl");
		expect(backdrop.contains(screen.getByRole("img"))).toBe(true);
		// Layers of soft light, not a flat fill: three radial lights over a base.
		expect(backdrop.className.match(/radial-gradient\(/g)).toHaveLength(3);
		expect(backdrop.className).toContain("oklch(0.9_0.02_300)");
		expect(backdrop.className).toContain("oklch(0.82_0.02_250)");
		// Quiet: every color in it is nearly gray (chroma 0.04 or less), like the pearl and silver of the site.
		const chromas = [...backdrop.className.matchAll(/oklch\(([\d.]+)_([\d.]+)_/g)].map((m) =>
			Number(m[2]),
		);
		expect(chromas.length).toBeGreaterThanOrEqual(4);
		for (const chroma of chromas) expect(chroma).toBeLessThanOrEqual(0.04);
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
