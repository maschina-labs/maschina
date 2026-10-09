import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TryButton } from "./try-button.tsx";

const props = { href: "/x", className: "flex", labelClassName: "", chipClassName: "size-7" };

describe("the try button", () => {
	it("has no glint unless asked for: the header's button stays plain", () => {
		render(<TryButton {...props} />);
		expect(screen.getByRole("link").querySelector("[data-glint]")).toBeNull();
	});

	it("is plain pearl with no outline, so it is exactly as big as its box, like the gray button beside it", () => {
		render(<TryButton {...props} glint />);
		const { className } = screen.getByRole("link");
		expect(className).toContain("bg-[oklch(0.93_0.02_300)]");
		expect(className).not.toContain("linear-gradient");
		expect(className).toContain("hover:bg-[oklch(0.98_0.015_300)]");
		// No shadow, ring or border: any of them adds to the edge and makes the button look larger.
		expect(className).not.toMatch(/shadow-|ring|border|outline/);
		expect(className).not.toMatch(/rounded/);
	});

	it("has a glint that shows on pearl: a white core with silver on either side of it", () => {
		render(<TryButton {...props} glint />);
		const glint = screen.getByRole("link").querySelector("[data-glint]");
		expect(glint?.className).toContain("linear-gradient(90deg");
		expect(glint?.className).toContain("oklch(1_0_0)");
		expect(glint?.className).toContain("oklch(0.78_0.04_290");
		expect(glint?.className).toContain("blur-");
	});

	it("can carry a glint that sweeps across on hover, hidden from assistive technology", () => {
		render(<TryButton {...props} glint />);
		const link = screen.getByRole("link", { name: "Try Maschina" });
		const glint = link.querySelector("[data-glint]");
		expect(glint).toHaveAttribute("aria-hidden", "true");
		expect(link.className).toContain("overflow-hidden");
		expect(link.className).toContain("group");
		expect(glint?.className).toContain("group-hover:translate-x-");
		expect(glint?.className).toContain("motion-reduce:hidden");
		// The light passes behind the chip, never over it.
		const chip = link.querySelector("[data-chip]");
		expect(chip?.className).toContain("relative");
		expect(chip?.className).toContain("z-10");
		// It sweeps in on hover and does not sweep back on leave: only the hover state has a transition.
		const tokens = glint?.className.split(" ") ?? [];
		expect(tokens).toContain("group-hover:transition-transform");
		expect(tokens).not.toContain("transition-transform");
		expect(glint?.className).toContain("pointer-events-none");
	});
});
