import { act, render, screen } from "@testing-library/react";
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
	it("opens with the machine-economy headline and owner-control explanation", () => {
		render(<Hero authUrl={AUTH} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"The operating system for the machine economy.",
		);
		expect(screen.getByText(/Build machines that act on your behalf/)).toHaveTextContent(
			/rules you define/,
		);
	});
	it("keeps the primary action and a plain docs link, with generous copy spacing", () => {
		render(<Hero authUrl={AUTH} />);
		const start = screen.getByRole("link", { name: "Start for free" });
		const docs = screen.getByRole("link", { name: "Read the docs" });
		expect(start).toHaveAttribute("href", `${AUTH}/sign-up`);
		expect(start).toHaveClass("silver-button");
		expect(start.querySelector("[data-chip]")).toBeInTheDocument();
		expect(docs).toHaveAttribute("href", "/docs");
		expect(docs.className).not.toMatch(/bg-/);
		expect(docs.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		expect(screen.getByText(/Build machines that act on your behalf/)).toHaveClass(
			"mt-8",
			"leading-[1.7]",
		);
	});
	it("keeps the hero left aligned and the facts centered only on mobile", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		expect(section).toHaveClass("h-lvh", "items-start", "text-left");
		expect(section.className).not.toContain("sticky");
		expect(screen.getByText("Source-available, built on Solana.")).toHaveClass(
			"text-center",
			"md:text-left",
		);
		expect(screen.getByRole("heading", { level: 1 }).className).not.toContain("text-stroke");
	});

	it("holds the ribbon back until the page has finished loading and the browser is idle, so three.js never competes with the first paint", async () => {
		const idle = vi.fn((callback: () => void) => {
			callback();
			return 1;
		});
		vi.stubGlobal("requestIdleCallback", idle);
		const state = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
		render(<Hero authUrl={AUTH} />);
		expect(screen.queryByTestId("ribbon")).toBeNull();
		expect(idle).not.toHaveBeenCalled();
		act(() => {
			state.mockReturnValue("complete");
			window.dispatchEvent(new Event("load"));
		});
		expect(await screen.findByTestId("ribbon")).toBeInTheDocument();
		expect(idle).toHaveBeenCalledTimes(1);
		state.mockRestore();
		vi.unstubAllGlobals();
	});

	it("always draws the ribbon calmly, as before: nothing about it changes with the scroll", async () => {
		render(<Hero authUrl={AUTH} />);
		expect(await screen.findByTestId("ribbon")).toHaveAttribute("data-motion", "calm");
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
