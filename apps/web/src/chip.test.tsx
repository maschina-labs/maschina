import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionChip } from "./chip.tsx";

describe("a section chip", () => {
	it("is tiny: a line of small text with a small icon, square, no taller than a small button", () => {
		const { container } = render(<SectionChip icon="start">Start</SectionChip>);
		const chip = container.querySelector("[data-chip-tag]") as HTMLElement;
		expect(chip).toHaveTextContent("Start");
		expect(chip.className).toContain("h-5");
		expect(chip.className).toContain("text-[11px]");
		expect(chip.className).not.toMatch(/rounded/);
		expect(chip.className).toContain("inline-flex");
	});

	it("is solid, not glass: an opaque pearl fill with dark text, and no blur, no outline and no see-through fill", () => {
		const { container } = render(<SectionChip icon="watch">Watch</SectionChip>);
		const chip = container.querySelector("[data-chip-tag]") as HTMLElement;
		expect(chip.className).toContain("bg-[oklch(0.93_0.02_300)]");
		expect(chip.className).toContain("text-black");
		expect(chip.className).not.toMatch(/backdrop|outline|bg-white|\/\[0?\.\d+\]|\/\d\d/);
	});

	it("draws its icon from Phosphor, hidden from assistive technology, since the word says what it is", () => {
		const { container } = render(<SectionChip icon="limits">Limits</SectionChip>);
		const icon = container.querySelector("[data-chip-tag] svg") as SVGElement;
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(icon.getAttribute("class")).toContain("size-3");
		expect(screen.getByText("Limits")).toBeInTheDocument();
	});

	it("has an icon for every chapter of the story it names", () => {
		for (const icon of ["start", "watch", "limits", "shape", "proof", "next", "code"] as const) {
			const { container, unmount } = render(<SectionChip icon={icon}>Word</SectionChip>);
			expect(container.querySelector("[data-chip-tag] svg"), icon).not.toBeNull();
			unmount();
		}
	});
});
