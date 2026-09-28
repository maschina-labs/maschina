import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollTicks, tickFor } from "./scroll-ticks.tsx";

describe("the scroll ruler", () => {
	it("sits at the top tick at the top, and the last at the bottom", () => {
		expect(tickFor(0, 2000, 800)).toBe(0);
		expect(tickFor(1200, 2000, 800)).toBe(47);
		expect(tickFor(600, 2000, 800)).toBe(24);
	});

	it("stays at the top when the page does not scroll at all", () => {
		expect(tickFor(0, 800, 800)).toBe(0);
	});

	it("draws a ruler down each edge, hidden from screen readers", () => {
		const { container } = render(<ScrollTicks target={{ current: null }} />);
		const rulers = container.querySelectorAll('[aria-hidden="true"]');

		expect(rulers).toHaveLength(2);
		expect(rulers[0]?.children).toHaveLength(48);
	});
});
