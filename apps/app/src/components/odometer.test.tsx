import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Odometer } from "./odometer.tsx";

const columns = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLElement>("[style*='translateY']")].map(
		(each) => each.style.transform,
	);

describe("a rolling number", () => {
	it("reads as the real number, whatever is rolling", () => {
		render(<Odometer value="23.74" />);
		expect(screen.getByText("23.74")).toHaveClass("sr-only");
	});

	it("rolls each digit to its place, and leaves the point where it is", async () => {
		const { container } = render(<Odometer value="23.74" />);
		await vi.waitFor(() =>
			expect(columns(container)).toEqual([
				"translateY(-2em)",
				"translateY(-3em)",
				"translateY(-7em)",
				"translateY(-4em)",
			]),
		);
		expect(container.textContent).toContain(".");
	});

	it("rolls to a new number when it changes", async () => {
		const { container, rerender } = render(<Odometer value="1.00" />);
		rerender(<Odometer value="1.50" />);
		await vi.waitFor(() => expect(columns(container)[1]).toBe("translateY(-5em)"));
	});
});
