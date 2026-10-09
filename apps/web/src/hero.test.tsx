import { render, screen } from "@testing-library/react";
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

describe("the hero", () => {
	it("is a full screen of background and nothing else: no words, no buttons, nothing floating", () => {
		const { container } = render(<Hero />);
		const section = screen.getByRole("region", { name: "Maschina" });
		expect(section.className).toContain("min-h-dvh");
		expect(screen.queryByRole("heading")).toBeNull();
		expect(screen.queryAllByRole("link")).toHaveLength(0);
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(container.querySelectorAll("[data-tile]")).toHaveLength(0);
		expect(section.textContent).toBe("");
	});

	it("draws the silver and pearl ribbon, dark and calm, filling the section", async () => {
		render(<Hero />);
		const ribbon = await screen.findByTestId("ribbon");
		expect(ribbon).toHaveAttribute("data-field", "ribbon");
		expect(ribbon).toHaveAttribute("data-motion", "calm");
		expect(ribbon).toHaveAttribute("data-mode", "dark");
		expect(ribbon).toHaveAttribute("data-position", "absolute");
	});

	it("is decoration only: hidden from assistive technology and never in the way of a click", () => {
		render(<Hero />);
		const layers = screen.getByRole("region", { name: "Maschina" })
			.firstElementChild as HTMLElement;
		expect(layers).toHaveAttribute("aria-hidden", "true");
		expect(layers.className).toContain("pointer-events-none");
	});

	it("is dimmed, and melts into the page below it", () => {
		const { container } = render(<Hero />);
		expect(container.querySelector("[data-dim]")).not.toBeNull();
		expect(container.querySelector("[data-melt]")).not.toBeNull();
	});

	it("has no rounded corners anywhere", () => {
		const { container } = render(<Hero />);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
