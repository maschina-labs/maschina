import { fireEvent, render, screen, within } from "@testing-library/react";
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
		// A full screen: nothing of the next section shows until you scroll.
		expect(section.className).toContain("h-dvh");
		expect(section.className).toContain("min-h-[36rem]");
		expect(section.className).not.toContain("84dvh");
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
		// One line on anything wider than a phone: no width cap, no balancing into two.
		expect(line.className).toContain("sm:whitespace-nowrap");
		expect(line.className).not.toContain("max-w-");
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

	it("paints the headline in silver with a sheen, and a soft bloom behind it", () => {
		render(<Hero authUrl={AUTH} />);
		const { className } = screen.getByRole("heading", { level: 1 });
		// A gradient clipped to the letters, so the words themselves are the color.
		expect(className).toContain("bg-clip-text");
		expect(className).toContain("text-transparent");
		expect(className).toContain("linear-gradient(105deg");
		// The bloom is a glow that follows the letters' shape, not a box.
		expect(className).toContain("drop-shadow(");
		expect(className).not.toContain("animate-");
		// Silver only: no pink or violet hue in the gradient or the glow.
		expect(className).not.toMatch(/_(300|325)[)_/]/);
	});

	it("lights the letters under the cursor, and lets go when it leaves", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		const heading = screen.getByRole("heading", { level: 1 });
		heading.getBoundingClientRect = () =>
			({ left: 100, top: 200, width: 1000, height: 200 }) as DOMRect;
		expect(heading.className).toContain("radial-gradient(circle_");
		// The spot is placed relative to the headline, as a share of its size.
		fireEvent.pointerMove(section, { clientX: 600, clientY: 300 });
		expect(heading.style.getPropertyValue("--mx")).toBe("50%");
		expect(heading.style.getPropertyValue("--my")).toBe("50%");
		fireEvent.pointerMove(section, { clientX: 100, clientY: 200 });
		expect(heading.style.getPropertyValue("--mx")).toBe("0%");
		fireEvent.pointerLeave(section);
		expect(heading.style.getPropertyValue("--mx")).toBe("");
		expect(heading.style.getPropertyValue("--my")).toBe("");
	});

	it("does not follow a finger, or anyone who asked for less motion", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		const heading = screen.getByRole("heading", { level: 1 });
		heading.getBoundingClientRect = () =>
			({ left: 0, top: 0, width: 1000, height: 200 }) as DOMRect;
		fireEvent.pointerMove(section, { clientX: 500, clientY: 100, pointerType: "touch" });
		expect(heading.style.getPropertyValue("--mx")).toBe("");
		const original = window.matchMedia;
		window.matchMedia = ((query: string) => ({
			matches: query.includes("reduce"),
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			onchange: null,
			dispatchEvent: () => false,
		})) as typeof window.matchMedia;
		fireEvent.pointerMove(section, { clientX: 500, clientY: 100 });
		window.matchMedia = original;
		expect(heading.style.getPropertyValue("--mx")).toBe("");
	});

	it("groups the headline with its line, then leaves a real gap before the buttons", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		const line = within(section).getByText("AI decides. Maschina decides what it's allowed to do.");
		const buttons = within(section).getByRole("link", { name: "Start for free" })
			.parentElement as HTMLElement;
		expect(line.className).toContain("mt-4");
		expect(buttons.className).toContain("mt-14");
		// The block sits a little below the middle of the screen.
		expect(section.className).toContain("pt-32");
		expect(section.className).toContain("pb-16");
	});

	it("keeps the proof line at the foot of the screen, off the stack", () => {
		render(<Hero authUrl={AUTH} />);
		const proof = screen.getByRole("link", {
			name: "Range Finder has traded real money on Solana since September 28.",
		}).parentElement as HTMLElement;
		expect(proof.className).toContain("absolute");
		expect(proof.className).toContain("inset-x-0");
		expect(proof.className).toContain("bottom-8");
		expect(proof.className).toContain("z-20");
	});

	it("puts a glint on both buttons, without changing what they are called", () => {
		render(<Hero authUrl={AUTH} />);
		const hero = within(screen.getByRole("region", { name: "Maschina" }));
		for (const name of ["Start for free", "Read the docs"]) {
			const link = hero.getByRole("link", { name });
			expect(link.querySelector("[data-glint]")).toHaveAttribute("aria-hidden", "true");
			expect(link.className).toContain("overflow-hidden");
		}
	});

	it("stays pinned to the top of the screen, so the next section can roll over it", () => {
		render(<Hero authUrl={AUTH} />);
		const { className } = screen.getByRole("region", { name: "Maschina" });
		expect(className).toContain("sticky");
		expect(className).toContain("top-0");
		expect(className).toContain("z-0");
	});

	it("has a bigger headline than before", () => {
		render(<Hero authUrl={AUTH} />);
		expect(screen.getByRole("heading", { level: 1 }).className).toContain(
			"clamp(2.5rem,6.4vw,7.5rem)",
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
