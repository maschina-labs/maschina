import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Proof } from "./proof.tsx";

describe("the proof section", () => {
	it("is empty for now: its content is built later, one piece at a time", () => {
		render(<Proof />);
		const section = screen.getByRole("region", { name: "Proof" });
		expect(section.textContent).toBe("");
		expect(section.children).toHaveLength(0);
	});

	it("is pearl white, never flat white, with the page's margins and a full screen of height", () => {
		render(<Proof />);
		const { className } = screen.getByRole("region", { name: "Proof" });
		expect(className).toContain("bg-[oklch(0.95_0.012_300)]");
		expect(className).not.toMatch(/bg-white|bg-\[#fff/);
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("min-h-dvh");
		expect(className).not.toMatch(/rounded/);
	});

	it("sits above the hero, so it rolls over it as the page scrolls", () => {
		render(<Proof />);
		const { className } = screen.getByRole("region", { name: "Proof" });
		expect(className).toContain("relative");
		expect(className).toContain("z-10");
	});
});
