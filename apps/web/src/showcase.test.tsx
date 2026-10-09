import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Showcase } from "./showcase.tsx";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

describe("the showcase", () => {
	it("shows a real screenshot of the app, as one figure", () => {
		render(<Showcase />);
		const section = screen.getByRole("region", { name: "The app" });
		const figure = within(section).getByRole("figure");
		const image = within(figure).getByRole("img");
		expect(image).toHaveAttribute("src", "/showcase/dashboard.jpg");
		expect(existsSync(resolve(publicDir, "showcase/dashboard.jpg"))).toBe(true);
		// It says what is in it, for anyone who cannot see it.
		expect(image.getAttribute("alt")).toMatch(/home screen/);
		expect(image.getAttribute("alt")).toMatch(/chart/);
		// Its size is declared, so the page does not jump as it loads.
		expect(image).toHaveAttribute("width", "2624");
		expect(image).toHaveAttribute("height", "1640");
		expect(image).toHaveAttribute("decoding", "async");
	});

	it("says plainly that it is sample data", () => {
		render(<Showcase />);
		expect(screen.getByText("The Maschina app, shown with sample data.")).toBeInTheDocument();
	});

	it("is a plain, static picture: no video, no canvas, no animation", () => {
		const { container } = render(<Showcase />);
		expect(container.querySelector("video, canvas, iframe")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-/);
	});

	it("fills the width between the page margins, on black, with square corners", () => {
		const { container } = render(<Showcase />);
		const { className } = screen.getByRole("region", { name: "The app" });
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("bg-black");
		expect(screen.getByRole("img").className).toContain("w-full");
		expect(screen.getByRole("img").className).toContain("h-auto");
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
