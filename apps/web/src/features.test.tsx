import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Features } from "./features.tsx";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const FEATURES = [
	["portfolio", "See the whole portfolio at a glance."],
	["decisions", "Every decision is written down."],
	["manager", "Ask your manager."],
	["customize", "Make it yours."],
] as const;

const carousel = () => screen.getByRole("region", { name: "Inside the app" });
const track = () => carousel().querySelector("[data-track]") as HTMLElement;
const slides = () => within(carousel()).getAllByRole("figure");
const heading = () => within(carousel()).getByRole("heading", { level: 3 });
const scrollTo = vi.fn();

beforeEach(() => {
	scrollTo.mockClear();
	Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
	Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1000 });
});

describe("the slider of screens", () => {
	it("is one carousel that holds four screens of the app, one slide each, in this order", () => {
		render(<Features />);
		expect(carousel()).toHaveAttribute("aria-roledescription", "carousel");
		expect(slides()).toHaveLength(4);
		for (const [index, [name]] of FEATURES.entries()) {
			const slide = slides()[index] as HTMLElement;
			expect(slide).toHaveAttribute("aria-roledescription", "slide");
			expect(slide).toHaveAttribute("aria-label", `${index + 1} of 4`);
			expect(within(slide).getByRole("img")).toHaveAttribute(
				"src",
				`/showcase/feature-${name}.jpg`,
			);
			expect(existsSync(resolve(publicDir, "showcase", `feature-${name}.jpg`))).toBe(true);
		}
	});

	it("keeps one heading above the screens that changes with the slide, left aligned with one short gray line", () => {
		render(<Features />);
		expect(within(carousel()).getAllByRole("heading")).toHaveLength(1);
		expect(heading()).toHaveTextContent(FEATURES[0][1]);
		const words = heading().parentElement as HTMLElement;
		expect(words.className).toContain("text-left");
		expect(words.className).not.toContain("text-center");
		expect(words).toHaveAttribute("aria-live", "polite");
		expect(words.querySelectorAll("p")).toHaveLength(1);
		expect((words.querySelector("p")?.textContent ?? "").length).toBeLessThanOrEqual(160);
		expect(words.querySelector("p")?.className).toContain("text-neutral-400");
		expect(words.querySelectorAll("a, button, svg")).toHaveLength(0);
	});

	it("slides sideways by itself, one whole screen at a time, so a finger or a trackpad swipe works without any script", () => {
		render(<Features />);
		expect(track().className).toContain("overflow-x-auto");
		expect(track().className).toContain("snap-x");
		expect(track().className).toContain("snap-mandatory");
		for (const slide of slides()) {
			expect(slide.className).toContain("snap-start");
			expect(slide.className).toContain("shrink-0");
			expect(slide.className).toContain("basis-full");
		}
	});

	it("is honest that rearranging your own screens is coming, and claims nothing that is not built", () => {
		render(<Features />);
		const element = track();
		element.scrollLeft = 3000;
		fireEvent.scroll(element);
		expect(heading()).toHaveTextContent("Make it yours.");
		const text = heading().parentElement?.textContent ?? "";
		expect(text).toMatch(/coming soon/i);
		expect(text).not.toMatch(/\bany\b|unlimited|anything you/i);
	});

	it("starts on the first screen, with the way back switched off", () => {
		render(<Features />);
		expect(screen.getByText("1 / 4")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Previous screen" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Next screen" })).toBeEnabled();
	});

	it("moves one screen on a press of the arrows", () => {
		render(<Features />);
		fireEvent.click(screen.getByRole("button", { name: "Next screen" }));
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 1000 }));
	});

	it("keeps the count and the arrows right as the reader swipes", () => {
		render(<Features />);
		const element = track();
		element.scrollLeft = 3000;
		fireEvent.scroll(element);
		expect(screen.getByText("4 / 4")).toBeInTheDocument();
		expect(heading()).toHaveTextContent(FEATURES[3][1]);
		expect(screen.getByRole("button", { name: "Next screen" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Previous screen" })).toBeEnabled();
		fireEvent.click(screen.getByRole("button", { name: "Previous screen" }));
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 2000 }));
	});

	it("puts the screens on a backdrop like the preview's, in a different tone, with the same room around and a quiet, nearly gray palette", () => {
		const { container } = render(<Features />);
		const backdrop = container.querySelector("[data-backdrop]") as HTMLElement;
		expect(backdrop).not.toBeNull();
		expect(backdrop).toHaveAttribute("data-tone", "silver");
		expect(backdrop.contains(track())).toBe(true);
		expect(backdrop.className.match(/radial-gradient\(/g)).toHaveLength(3);
		expect(backdrop.className).toContain("p-[clamp(1.25rem,7vw,7rem)]");
		expect(backdrop.querySelector("[data-grain]")).not.toBeNull();
		// Not the preview's pearl: none of its lights are reused.
		expect(backdrop.className).not.toContain("oklch(0.9_0.02_300)");
		const chromas = [...backdrop.className.matchAll(/oklch\(([\d.]+)_([\d.]+)_/g)].map((m) =>
			Number(m[2]),
		);
		expect(chromas.length).toBeGreaterThanOrEqual(4);
		for (const chroma of chromas) expect(chroma).toBeLessThanOrEqual(0.04);
		// The dark screens lift off the light with an ordinary dark shadow, like the preview.
		for (const image of screen.getAllByRole("img"))
			expect(image.className).toMatch(/shadow-\[[^\]]*oklch\(0_0_0\/0\.\d+\)\]/);
	});

	it("shows each whole screen the way the preview does: the same shape, sized in the markup, loaded as you near it, no panel, outline or background", () => {
		const { container } = render(<Features />);
		for (const image of screen.getAllByRole("img")) {
			expect(image).toHaveAttribute("loading", "lazy");
			expect(image).toHaveAttribute("decoding", "async");
			expect(image).toHaveAttribute("fetchpriority", "low");
			expect(image).toHaveAttribute("width", "2838");
			expect(image).toHaveAttribute("height", "1800");
			expect(image.getAttribute("alt")).toMatch(/screen of the Maschina app/);
			expect(image.className).toContain("w-full");
			expect(image.className).not.toMatch(/border|outline|ring|object-cover/);
		}
		expect(container.querySelector("[data-background], canvas")).toBeNull();
		expect(container.innerHTML).not.toMatch(/rounded|bg-white\/\[0\.04\]/);
	});

	it("is square, on black, with the arrows as plain square buttons and no vendor named", () => {
		const { container } = render(<Features />);
		expect(carousel().className).toContain("bg-black");
		for (const name of ["Previous screen", "Next screen"])
			expect(screen.getByRole("button", { name }).className).toContain("size-10");
		expect(container.textContent ?? "").not.toMatch(/turnkey|helius|jupiter|anthropic|partner/i);
	});
});
