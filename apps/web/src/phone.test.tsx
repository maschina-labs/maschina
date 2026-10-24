import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Closing } from "./closing.tsx";
import { Hero } from "./hero.tsx";
import { Showcase } from "./showcase.tsx";

describe("mobile actions and preview", () => {
	it.each([Hero, Closing])(
		"stacks full-width actions without squeezing the labels",
		(Component) => {
			render(<Component authUrl="/auth" />);
			const action = screen.getByRole("link", { name: "Start for free" });
			expect(action.parentElement).toHaveClass("flex-col", "items-stretch", "sm:flex-row");
			expect(action.querySelector("span")).toHaveClass("text-center");
			expect(screen.getByRole("link", { name: "Read the docs" })).toHaveClass("justify-center");
			expect(action.querySelector("[data-chip]")).toHaveClass("max-sm:hidden");
		},
	);
	it("keeps the preview inside its frame with sideways access to the full app screenshot", () => {
		render(<Showcase />);
		const image = screen.getByRole("img");
		expect(image).toHaveClass("max-sm:w-[320%]", "h-auto");
		expect(image.closest("figure")).toHaveClass("w-full");
		expect(image.closest("[data-backdrop]")).toHaveClass("max-sm:overflow-x-auto");
		expect(screen.getByText(/shown with sample data/)).toBeInTheDocument();
	});
});
