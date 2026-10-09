import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "./footer.tsx";

const spot = (container: HTMLElement) => container.querySelector("[data-spot]") as SVGCircleElement;

describe("the footer", () => {
	it("says who owns it, in the year it is now", () => {
		vi.useFakeTimers({ now: new Date("2031-03-01T12:00:00Z"), toFake: ["Date"] });
		render(<Footer />);
		expect(
			within(screen.getByRole("contentinfo")).getByText(
				"© 2031 Maschina Labs. All rights reserved.",
			),
		).toBeInTheDocument();
		vi.useRealTimers();
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
