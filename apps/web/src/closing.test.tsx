import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Closing } from "./closing.tsx";

// The particles are WebGL, which a test browser does not have, so they are stood in for. The field has its own tests.
vi.mock("@maschina/field", () => ({
	FogBackground: (props: { field?: string; motion?: string; position?: string; mode?: string }) => (
		<div
			data-testid="particles"
			data-field={props.field}
			data-motion={props.motion}
			data-position={props.position}
			data-mode={props.mode}
		/>
	),
}));

const AUTH = "https://auth.maschina.dev";

describe("the closing call to action", () => {
	it("says what it costs to try, in two plain lines", () => {
		render(<Closing authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Get started" });
		expect(
			within(section).getByRole("heading", { level: 2, name: "Try a machine on paper first." }),
		).toBeInTheDocument();
		expect(
			within(section).getByText("It costs nothing to try. Move to real money when you trust it."),
		).toBeInTheDocument();
	});

	it("has the two buttons: start for free, and the docs", () => {
		render(<Closing authUrl={AUTH} />);
		const section = within(screen.getByRole("region", { name: "Get started" }));
		expect(section.getByRole("link", { name: "Start for free" })).toHaveAttribute(
			"href",
			`${AUTH}/sign-up`,
		);
		expect(section.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", "/docs");
	});

	it("is dark, like the page, and sits above the pinned hero so it rolls up over it", () => {
		render(<Closing authUrl={AUTH} />);
		const { className } = screen.getByRole("region", { name: "Get started" });
		expect(className).toContain("bg-black");
		expect(className).not.toMatch(/bg-white|oklch\(0\.95/);
		expect(className).toContain("relative");
		expect(className).toContain("z-10");
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("text-center");
	});

	it("has the same buttons as the hero: pearl with a chip, and the gray docs box", () => {
		render(<Closing authUrl={AUTH} />);
		const start = screen.getByRole("link", { name: "Start for free" });
		expect(start.className).toContain("bg-[oklch(0.93_0.02_300)]");
		const chip = start.querySelector("[data-chip]") as HTMLElement;
		expect(chip.className).toContain("bg-black");
		const docs = screen.getByRole("link", { name: "Read the docs" });
		expect(docs.className).toMatch(/\bbg-white\/\[0\.13\]/);
		expect(docs.querySelector("[data-glint]")).not.toBeNull();
		expect(docs.className).not.toMatch(/rounded/);
	});

	it("has its headline in silver, like the hero's", () => {
		render(<Closing authUrl={AUTH} />);
		const { className } = screen.getByRole("heading", { level: 2 });
		expect(className).toContain("bg-clip-text");
		expect(className).toContain("text-transparent");
		expect(className).toContain("linear-gradient(105deg");
	});

	it("has the particles behind it: dark, calm, filling the section, fading in once loaded", async () => {
		render(<Closing authUrl={AUTH} />);
		const particles = await screen.findByTestId("particles");
		expect(particles).toHaveAttribute("data-field", "particles");
		expect(particles).toHaveAttribute("data-motion", "calm");
		expect(particles).toHaveAttribute("data-mode", "dark");
		expect(particles).toHaveAttribute("data-position", "absolute");
		expect(particles.parentElement?.className).toContain("animate-fade-in");
	});

	it("keeps the particles to decoration: hidden from assistive technology, never in the way of a click", () => {
		render(<Closing authUrl={AUTH} />);
		const layers = screen.getByRole("region", { name: "Get started" })
			.firstElementChild as HTMLElement;
		expect(layers).toHaveAttribute("aria-hidden", "true");
		expect(layers.className).toContain("pointer-events-none");
		// The words and buttons sit above them.
		expect(screen.getByRole("heading", { level: 2 }).className).toContain("z-20");
		expect(screen.getByRole("link", { name: "Read the docs" }).parentElement?.className).toContain(
			"z-20",
		);
	});

	it("has no rounded corners anywhere", () => {
		const { container } = render(<Closing authUrl={AUTH} />);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
