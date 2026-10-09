import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("pins the hero to the top, so the footer rolls up over it", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const { className } = screen.getByRole("main");
		expect(className).toContain("sticky");
		expect(className).toContain("top-0");
		expect(className).toContain("z-0");
		// Pinned by the page, not the hero: both the hero and the footer sit inside the same page.
		expect(screen.getByRole("main").nextElementSibling).toBe(screen.getByRole("contentinfo"));
	});

	it("has the header, then the hero with its headline, and ends with the footer", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			within(screen.getByRole("main")).getByRole("region", { name: "Maschina" }),
		).toBeInTheDocument();
		expect(
			within(screen.getByRole("main")).getByRole("heading", {
				level: 1,
				name: "The operating system for autonomous capital.",
			}),
		).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});
});
