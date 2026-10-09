import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("gives the page a full screen of room, so there is something to scroll through", () => {
		render(<Site />);
		expect(screen.getByRole("main").className).toContain("min-h-[200dvh]");
	});

	it("opens with the hero and ends with the footer", () => {
		render(<Site />);
		expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});
});
