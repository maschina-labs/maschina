import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Closing } from "./closing.tsx";

describe("the closing section", () => {
	it("is empty for now: its content is worked out later", () => {
		render(<Closing />);
		const section = screen.getByRole("region", { name: "Get started" });
		expect(section.textContent).toBe("");
		expect(section.children).toHaveLength(0);
	});

	it("draws nothing on the graphics card: no canvas, no WebGL", () => {
		const { container } = render(<Closing />);
		expect(container.querySelector("canvas")).toBeNull();
	});

	it("is dark, like the page, and is an ordinary section: it scrolls into view and covers nothing", () => {
		render(<Closing />);
		const { className } = screen.getByRole("region", { name: "Get started" });
		expect(className).toContain("bg-black");
		expect(className).toContain("relative");
		expect(className).not.toContain("z-10");
		expect(className).toContain("min-h-[80dvh]");
		expect(className).toContain("px-(--gutter)");
		expect(className).not.toMatch(/rounded/);
	});
});
