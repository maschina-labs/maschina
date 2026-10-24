import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Closing } from "./closing.tsx";
import { Hero } from "./hero.tsx";

describe("the hero and closing actions", () => {
	it.each([Hero, Closing])("uses matching primary and docs action heights", (Component) => {
		render(<Component authUrl="/auth" />);
		for (const name of ["Start for free", "Read the docs"]) {
			const action = screen.getByRole("link", { name });
			expect(action).toHaveClass("h-10", "xl:h-8");
		}
	});
});
