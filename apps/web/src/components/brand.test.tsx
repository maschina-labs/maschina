import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoMark, Wordmark } from "./brand.tsx";

describe("the brand marks", () => {
	it("name themselves, so a screen reader says Maschina rather than nothing", () => {
		render(<LogoMark />);
		expect(screen.getByRole("img", { name: "Maschina" })).toBeInTheDocument();
	});

	it("take the colour of the text around them, so they stay readable on any background", () => {
		render(<Wordmark className="h-5" />);
		const svg = screen.getByRole("img", { name: "Maschina" });

		expect(svg).toHaveAttribute("fill", "currentColor");
		expect(svg).toHaveClass("h-5");
	});

	it("keep the cutout in the mark", () => {
		const { container } = render(<LogoMark />);
		expect(container.querySelector("path")).toHaveAttribute("fill-rule", "evenodd");
	});
});
