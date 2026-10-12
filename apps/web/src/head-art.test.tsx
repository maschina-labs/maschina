import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeadArt } from "./head-art.tsx";

describe("the art behind a page head", () => {
	it("is decoration, hidden from assistive technology, and never catches the pointer", () => {
		const { container } = render(<HeadArt />);
		const art = container.querySelector("[data-art]") as HTMLElement;
		expect(art).toHaveAttribute("aria-hidden", "true");
		expect(art.className).toContain("pointer-events-none");
	});

	it("lays frosted glass over the moving mesh, so what is behind the words is soft and clean and not smudged", () => {
		const { container } = render(<HeadArt />);
		const art = container.querySelector("[data-art]") as HTMLElement;
		const glass = art.querySelector("[data-glass]") as HTMLElement;
		expect(glass).not.toBeNull();
		// A blur of what is behind it, and a light tint on top, filling the whole head.
		expect(glass.className).toMatch(/backdrop-blur/);
		expect(glass.className).toContain("inset-0");
		expect(glass.className).toMatch(/bg-/);
		// It comes after the mesh, so it is over it.
		const children = [...art.children];
		expect(children.indexOf(glass)).toBe(children.length - 1);
	});
});
