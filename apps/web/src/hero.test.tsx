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
		// The buttons and the docs are centered under the headline too, on a phone as well.
		const hero = within(section);
		const buttons = hero.getByRole("link", { name: "Start for free" }).parentElement as HTMLElement;
		expect(buttons.className).toContain("sm:justify-center");
		expect(hero.getByRole("link", { name: "Read the docs" }).className).toContain("justify-center");
	});

	it("has two buttons under the headline: start for free, and the docs", () => {
		render(<Hero authUrl={AUTH} />);
		const hero = within(screen.getByRole("region", { name: "Maschina" }));
		// The two buttons come first; the proof line's link is after them.
		expect(
			hero
				.getAllByRole("link")
				.slice(0, 2)
				.map((link) => link.textContent),
		).toEqual(["Start for free", "Read the docs"]);
		const start = hero.getByRole("link", { name: "Start for free" });
		expect(start).toHaveAttribute("href", `${AUTH}/sign-up`);
		expect(start.querySelector("[data-chip] svg")).toHaveAttribute("aria-hidden", "true");
		expect(start.querySelector("[data-chip] svg")).toHaveAttribute("data-arrow", "chevron");
		const docs = hero.getByRole("link", { name: "Read the docs" });
		expect(docs).toHaveAttribute("href", "/docs");
		// The docs are a box of their own, a quiet gray one, with no arrow: only the main button has a chip.
		expect(docs.className).toMatch(/\bbg-white\/\[0\.13\]/);
		expect(docs.className).not.toMatch(/rounded/);
		expect(docs.querySelector("svg")).toBeNull();
		expect(docs.querySelector("[data-chip]")).toBeNull();
	});

	it("says what it does under the headline, in one quiet line", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		const heading = within(section).getByRole("heading", { level: 1 });
		const line = within(section).getByText("AI decides. Maschina decides what it's allowed to do.");
		expect(line.tagName).toBe("P");
		expect(line.className).toContain("z-20");
		// Straight after the headline, before the buttons.
		expect(heading.nextElementSibling).toBe(line);
		expect(line.nextElementSibling).toBe(
			within(section).getByRole("link", { name: "Start for free" }).parentElement,
		);
	});

	it("ends with one proof line that links to the live record", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		const proof = within(section).getByRole("link", {
			name: "Range Finder has traded real money on Solana since September 28.",
		});
		expect(proof).toHaveAttribute("href", "/live");
		expect(section.lastElementChild).toBe(proof.parentElement);
	});

	it("has nothing else on it: nothing floating", () => {
		const { container } = render(<Hero authUrl={AUTH} />);
		expect(container.querySelectorAll("[data-tile]")).toHaveLength(0);
	});

	it("paints the headline in silver and pearl with a sheen, and a soft bloom behind it", () => {
		render(<Hero authUrl={AUTH} />);
		const { className } = screen.getByRole("heading", { level: 1 });
		// A gradient clipped to the letters, so the words themselves are the color.
		expect(className).toContain("bg-clip-text");
		expect(className).toContain("text-transparent");
		expect(className).toContain("bg-[linear-gradient(");
		// The bloom is a glow that follows the letters' shape, not a box.
		expect(className).toContain("drop-shadow(");
		expect(className).not.toContain("animate-");
	});

	it("has a bigger headline than before", () => {
		render(<Hero authUrl={AUTH} />);
		expect(screen.getByRole("heading", { level: 1 }).className).toContain(
			"clamp(2.25rem,5.4vw,6rem)",
		);
	});

	it("draws the silver and pearl ribbon, dark and calm, filling the section", async () => {
		render(<Hero authUrl={AUTH} />);
		const ribbon = await screen.findByTestId("ribbon");
		expect(ribbon).toHaveAttribute("data-field", "ribbon");
		expect(ribbon).toHaveAttribute("data-motion", "calm");
		expect(ribbon).toHaveAttribute("data-mode", "dark");
		expect(ribbon).toHaveAttribute("data-position", "absolute");
		// It fades in once it has loaded, rather than popping.
		expect(ribbon.parentElement?.className).toContain("animate-fade-in");
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
