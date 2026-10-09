import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("gives the page a full screen of room, so there is something to scroll through", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		expect(screen.getByRole("main").className).toContain("min-h-[200dvh]");
	});

	it("has the header and the footer", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});
});
