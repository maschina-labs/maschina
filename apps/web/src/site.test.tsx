import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	it("has the proof section straight after the hero", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const main = within(screen.getByRole("main"));
		const hero = main.getByRole("region", { name: "Maschina" });
		const proof = main.getByRole("region", { name: "Proof" });
		expect(hero.nextElementSibling).toBe(proof);
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
