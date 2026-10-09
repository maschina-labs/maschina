import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("The docs", () => {
	it("is a blank black page until its design lands", () => {
		render(<Site />);
		const page = screen.getByRole("main", { name: "Maschina docs" });
		expect(page).toBeEmptyDOMElement();
		expect(page.className).toContain("bg-black");
	});
});
