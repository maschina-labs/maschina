import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("gives the page a full screen of room, so there is something to scroll through", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		expect(screen.getByRole("main", { name: "Maschina" }).className).toContain("min-h-[200dvh]");
	});

	it("is blank above the footer until its design lands", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const page = screen.getByRole("main", { name: "Maschina" });
		expect(page).toBeEmptyDOMElement();
	});
});
