import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("gives the page a full screen of room, so there is something to scroll through", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		expect(screen.getByRole("main").className).toContain("min-h-[200dvh]");
	});

	it("has the header, then the background hero, and ends with the footer", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			within(screen.getByRole("main")).getByRole("region", { name: "Maschina" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});
});
