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

	it("says plainly that it is sample data, centered under the picture", () => {
		render(<Showcase />);
		const caption = screen.getByText("The Maschina app, shown with sample data.");
		expect(caption.tagName).toBe("FIGCAPTION");
		expect(caption.className).toContain("text-center");
	});

	it("is a plain picture: no video, no canvas, no animation, and nothing that moves with the scroll", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("video, canvas, iframe")).toBeNull();
		expect(container.querySelector("[data-tilt]")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-|will-change/);
	});

	describe("the lean toward the mouse", () => {
		const box = { left: 100, top: 100, width: 1000, height: 600 };
		const setup = () => {
			render(<Showcase />);
			const backdrop = document.querySelector("[data-backdrop]") as HTMLElement;
			backdrop.getBoundingClientRect = () => box as DOMRect;
			// The picture and its shine sit in one wrapper, which is what leans.
			const picture = document.querySelector("[data-picture]") as HTMLElement;
			const read = (name: string) => picture.style.getPropertyValue(name);
			return { backdrop, picture, read };
		};

		it("leans toward the cursor on both axes, so all four corners move", () => {
			const { backdrop, read } = setup();
			fireEvent.pointerMove(backdrop, { clientX: 1100, clientY: 100 });
			// The top right corner: all the way right, all the way up.
			expect(read("--tx")).toBe("1");
			expect(read("--ty")).toBe("-1");
			fireEvent.pointerMove(backdrop, { clientX: 100, clientY: 700 });
			expect(read("--tx")).toBe("-1");
			expect(read("--ty")).toBe("1");
			fireEvent.pointerMove(backdrop, { clientX: 600, clientY: 400 });
			expect(Number(read("--tx"))).toBe(0);
			expect(Number(read("--ty"))).toBe(0);
			fireEvent.pointerMove(backdrop, { clientX: 850, clientY: 250 });
			expect(Number(read("--tx"))).toBeCloseTo(0.5, 5);
			expect(Number(read("--ty"))).toBeCloseTo(-0.5, 5);
		});

		it("never goes past full lean, wherever the cursor is", () => {
			const { backdrop, read } = setup();
			fireEvent.pointerMove(backdrop, { clientX: 5000, clientY: -900 });
			expect(read("--tx")).toBe("1");
			expect(read("--ty")).toBe("-1");
		});

		it("comes back level when the cursor leaves", () => {
			const { backdrop, read } = setup();
			fireEvent.pointerMove(backdrop, { clientX: 1100, clientY: 100 });
			fireEvent.pointerLeave(backdrop);
			expect(read("--tx")).toBe("0");
			expect(read("--ty")).toBe("0");
		});

		it("ignores a finger", () => {
			const { backdrop, read } = setup();
			fireEvent.pointerMove(backdrop, { clientX: 1100, clientY: 100, pointerType: "touch" });
			expect(read("--tx")).toBe("");
		});

		it("does not lean for anyone who asked for less motion", () => {
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
			const { backdrop, read } = setup();
			fireEvent.pointerMove(backdrop, { clientX: 1100, clientY: 100 });
			window.matchMedia = original;
			expect(read("--tx")).toBe("");
		});

		it("is lit like a lamp is shining on it: a broad soft band of light that slides across as the picture leans, not a glow around the cursor", () => {
			const { backdrop, picture, read } = setup();
			const shine = picture.querySelector("[data-shine]") as HTMLElement;
			const band = shine.querySelector("[data-band]") as HTMLElement;
			expect(shine).toHaveAttribute("aria-hidden", "true");
			expect(shine.className).toContain("pointer-events-none");
			expect(shine.className).toContain("overflow-hidden");
			expect(picture.contains(shine)).toBe(true);
			// Nothing here is drawn around the cursor.
			expect(picture.innerHTML).not.toMatch(/radial-gradient|--sx|--sy|--shine/);
			// A wide, slanted, soft-edged band, always there at a low strength...
			expect(band.className).toContain(
				"linear-gradient(100deg,transparent,oklch(1_0_0/0.1)_50%,transparent)",
			);
			expect(band.className).toContain("-skew-x-12");
			// ...whose position is read from the same lean, so it slides as the picture turns, and eases with it.
			expect(band.className).toContain("translateX(calc(25%+var(--tx)*60%))");
			expect(band.className).toContain("transition-transform");
			expect(band.className).toContain("duration-200");
			expect(band.className).toContain("motion-reduce:transition-none");
			// And a gentle falloff across the whole picture, lighter toward the top left where the lamp is.
			const falloff = shine.querySelector("[data-falloff]") as HTMLElement;
			expect(falloff.className).toContain("bg-gradient-to-br");
			expect(falloff.className).toContain("from-white/[0.05]");
			expect(falloff.className).toContain("to-black/[0.1]");
			// The cursor only turns the picture; it sets no position of its own for the light.
			fireEvent.pointerMove(backdrop, { clientX: 1100, clientY: 100 });
			expect(read("--sx")).toBe("");
			expect(read("--shine")).toBe("");
			expect(read("--tx")).toBe("1");
		});

		it("is a light lean: 3 degrees at most each way, eased, about the picture's own middle", () => {
			const { picture } = setup();
			expect(picture.className).toContain("[--tx:0]");
			expect(picture.className).toContain("[--ty:0]");
			expect(picture.className).toContain(
				"[transform:perspective(1400px)_rotateX(calc(var(--ty)*-3deg))_rotateY(calc(var(--tx)*3deg))]",
			);
			expect(picture.className).toContain("transition-transform");
			expect(picture.className).toContain("duration-200");
			expect(picture.className).toContain("ease-out");
			expect(picture.className).toContain("motion-reduce:transition-none");
		});
	});

	it("sits centered in a backdrop of its own: a wide panel of soft pearl and silver light, with room all around", () => {
		const { container } = render(<Showcase />);
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).not.toBeNull();
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
		const { className } = document.querySelector("[data-picture]") as HTMLElement;
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
