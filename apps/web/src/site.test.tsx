import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("is blank above the footer until its design lands", () => {
		render(<Site />);
		const page = screen.getByRole("main", { name: "Maschina" });
		expect(page).toBeEmptyDOMElement();
	});
});
