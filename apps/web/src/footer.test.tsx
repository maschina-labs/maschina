import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";

const spot = (container: HTMLElement) => container.querySelector("[data-spot]") as SVGCircleElement;

describe("the footer", () => {
	afterEach(() => vi.useRealTimers());

	it("has the copyright centered above the wordmark, with the current year", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2031-03-04T12:00:00Z"));
		render(<Footer />);
		const footer = screen.getByRole("contentinfo");
		const line = screen.getByText("© 2031 Maschina Labs. All rights reserved.");
		expect(line.className).toContain("text-center");
		// It comes before the wordmark, so it sits above it.
		const logo = screen.getByRole("img", { name: "Maschina" }).parentElement as HTMLElement;
		expect(footer.firstElementChild).toBe(line);
		expect(line.nextElementSibling).toBe(logo);
	});

	it("keeps to the shared page margin", () => {
		render(<Footer />);
		expect(screen.getByRole("contentinfo").className).toContain("px-(--gutter)");
	});

	it("is a full screen with the wordmark at the foot of it", () => {
		render(<Footer />);
		const { className } = screen.getByRole("contentinfo");
		expect(className).toContain("min-h-dvh");
		expect(className).toContain("flex-col");
		expect(className).toContain("justify-end");
	});

	it("sits above the hero, with its own edge, so it rolls up over it", () => {
		render(<Footer />);
		const { className } = screen.getByRole("contentinfo");
		expect(className).toContain("relative");
		expect(className).toContain("z-10");
		expect(className).toContain("border-t");
		expect(className).toContain("bg-black");
	});

	it("carries the wordmark, named once for screen readers", () => {
		render(<Footer />);
		expect(screen.getByRole("img", { name: "Maschina" })).toBeInTheDocument();
	});

	it("draws the wordmark once, as outlines, with a lit copy for the cursor", () => {
		const { container } = render(<Footer />);
		expect(container.querySelectorAll("[data-layer]")).toHaveLength(2);
		// The eight letters, without the mark.
		expect(container.querySelectorAll("[data-layer] path")).toHaveLength(16);
	});

	it("lights the edges under the cursor, and lets them fade when it leaves", () => {
		const { container } = render(<Footer />);
		const svg = screen.getByRole("img", { name: "Maschina" });
		const [x = 0, y = 0, width = 1, height = 1] = (svg.getAttribute("viewBox") ?? "")
			.split(" ")
			.map(Number);
		svg.getBoundingClientRect = () =>
			({ left: 0, top: 0, width: 1000, height: 1000 * (height / width) }) as DOMRect;
		const lit = container.querySelector("[data-lit]") as SVGGElement;

		expect(lit.style.opacity).toBe("0");
		// The middle of the drawing, in screen pixels, is the middle of the drawing in its own units.
		fireEvent.pointerMove(svg, { clientX: 500, clientY: 500 * (height / width) });
		expect(Number(spot(container).getAttribute("cx"))).toBeCloseTo(x + width / 2);
		expect(Number(spot(container).getAttribute("cy"))).toBeCloseTo(y + height / 2);
		expect(lit.style.opacity).toBe("1");

		fireEvent.pointerLeave(svg);
		expect(lit.style.opacity).toBe("0");
	});
});
