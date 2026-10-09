import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "./hero.tsx";

describe("the hero", () => {
	it("says what Maschina is, as the page's one main heading", () => {
		render(<Hero />);
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "The operating system for autonomous capital.",
			}),
		).toBeInTheDocument();
	});

	it("is a full screen, with the headline centered in it", () => {
		render(<Hero />);
		const section = screen.getByRole("region", { name: "Maschina" });
		expect(section.className).toContain("min-h-dvh");
		expect(section.className).toContain("items-center");
		expect(section.className).toContain("justify-center");
		expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-center");
	});

	it("keeps to the shared page margin", () => {
		render(<Hero />);
		expect(screen.getByRole("region", { name: "Maschina" }).className).toContain("px-(--gutter)");
	});
});
