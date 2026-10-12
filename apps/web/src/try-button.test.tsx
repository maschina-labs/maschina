import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TryButton } from "./try-button.tsx";

const props = { href: "/x", className: "flex", labelClassName: "", chipClassName: "size-7" };

describe("the try button", () => {
	it("has no glint, anywhere: the button is plain pearl", () => {
		render(<TryButton {...props} />);
		expect(screen.getByRole("link").querySelector("[data-glint]")).toBeNull();
	});

	it("is plain pearl with no outline, so it is exactly as big as its box, like the gray button beside it", () => {
		render(<TryButton {...props} />);
		const { className } = screen.getByRole("link");
		expect(className).toContain("silver-button");
		expect(className).not.toContain("linear-gradient");
		expect(className).not.toContain("bg-[oklch(0.93_0.02_300)]");
		// No shadow, ring or border: any of them adds to the edge and makes the button look larger.
		expect(className).not.toMatch(/shadow-|ring|border|outline/);
		expect(className).not.toMatch(/rounded/);
	});
});
