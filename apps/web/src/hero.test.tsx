import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./hero.tsx";

// The ribbon is WebGL, which a test browser does not have, so it is stood in for. The field has its own tests.
vi.mock("@maschina/field", () => ({
	FogBackground: (props: { field?: string; motion?: string; position?: string; mode?: string }) => (
		<div
			data-testid="ribbon"
			data-field={props.field}
			data-motion={props.motion}
			data-position={props.position}
			data-mode={props.mode}
		/>
	),
}));

const AUTH = "https://auth.maschina.dev";

describe("the hero", () => {
	it("is a full screen with everything centered in it", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		expect(section.className).toContain("min-h-dvh");
		expect(section.className).toContain("items-center");
		expect(section.className).toContain("justify-center");
		expect(section.className).toContain("text-center");
		expect(section.className).toContain("px-(--gutter)");
		const heading = screen.getByRole("heading", {
			level: 1,
			name: "The operating system for autonomous capital.",
		});
		expect(heading.className).toContain("z-20");
	});

	it("gives three quick ways in, in the order of what most people want first", () => {
		render(<Hero authUrl={AUTH} />);
		const hero = within(screen.getByRole("region", { name: "Maschina" }));
		expect(hero.getAllByRole("link").map((link) => link.textContent)).toEqual([
			"Start for free",
			"Read the docs",
			"See the live record",
		]);
		const start = hero.getByRole("link", { name: "Start for free" });
		expect(start).toHaveAttribute("href", `${AUTH}/sign-up`);
		expect(start.querySelector("[data-chip] svg")).toHaveAttribute("aria-hidden", "true");
		expect(hero.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", "/docs");
		expect(hero.getByRole("link", { name: "See the live record" })).toHaveAttribute(
			"href",
			"/live",
		);
	});

	it("has nothing else on it: no line under the headline, nothing floating", () => {
		const { container } = render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		expect(section.textContent).toBe(
			"The operating system for autonomous capital.Start for freeRead the docsSee the live record",
		);
		expect(container.querySelectorAll("[data-tile]")).toHaveLength(0);
	});

	it("draws the silver and pearl ribbon, dark and calm, filling the section", async () => {
		render(<Hero authUrl={AUTH} />);
		const ribbon = await screen.findByTestId("ribbon");
		expect(ribbon).toHaveAttribute("data-field", "ribbon");
		expect(ribbon).toHaveAttribute("data-motion", "calm");
		expect(ribbon).toHaveAttribute("data-mode", "dark");
		expect(ribbon).toHaveAttribute("data-position", "absolute");
	});

	it("is decoration only: hidden from assistive technology and never in the way of a click", () => {
		render(<Hero authUrl={AUTH} />);
		const layers = screen.getByRole("region", { name: "Maschina" })
			.firstElementChild as HTMLElement;
		expect(layers).toHaveAttribute("aria-hidden", "true");
		expect(layers.className).toContain("pointer-events-none");
	});

	it("is dimmed, and melts into the page below it", () => {
		const { container } = render(<Hero authUrl={AUTH} />);
		expect(container.querySelector("[data-dim]")).not.toBeNull();
		expect(container.querySelector("[data-melt]")).not.toBeNull();
	});

	it("has no rounded corners anywhere", () => {
		const { container } = render(<Hero authUrl={AUTH} />);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
