import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The ribbon is WebGL, which a test browser does not have, so it is stood in for. The field has its own tests.
vi.mock("@maschina/field", () => ({
	FogBackground: (props: { field?: string; motion?: string; position?: string }) => (
		<div
			data-testid="ribbon"
			data-field={props.field}
			data-motion={props.motion}
			data-position={props.position}
		/>
	),
}));

import { Hero } from "./hero.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the hero", () => {
	it("says what Maschina is, as the page's one main heading", () => {
		render(<Hero authUrl={AUTH} />);
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "The operating system for autonomous capital.",
			}),
		).toBeInTheDocument();
	});

	it("says the one thing that makes it different, right under the headline", () => {
		render(<Hero authUrl={AUTH} />);
		expect(
			screen.getByText("AI decides. Maschina decides what it's allowed to do."),
		).toBeInTheDocument();
	});

	it("is a full screen, with everything centered in it", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		expect(section.className).toContain("min-h-dvh");
		expect(section.className).toContain("items-center");
		expect(section.className).toContain("justify-center");
		expect(section.className).toContain("text-center");
		expect(section.className).toContain("px-(--gutter)");
	});

	it("has two buttons: try it, and see the proof", () => {
		render(<Hero authUrl={AUTH} />);
		const hero = within(screen.getByRole("region", { name: "Maschina" }));
		const links = hero.getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["Try Maschina", "See the live record"]);
		const tryIt = hero.getByRole("link", { name: "Try Maschina" });
		expect(tryIt).toHaveAttribute("href", `${AUTH}/sign-up`);
		expect(tryIt.querySelector("[data-chip] svg")).toHaveAttribute("aria-hidden", "true");
		expect(hero.getByRole("link", { name: "See the live record" })).toHaveAttribute(
			"href",
			"/live",
		);
	});

	it("backs the claim with one true line, and nothing it cannot show", () => {
		render(<Hero authUrl={AUTH} />);
		expect(
			screen.getByText(
				"Range Finder has traded real money on Solana since September 28. Every trade is on chain.",
			),
		).toBeInTheDocument();
	});

	it("has no rounded corners anywhere", () => {
		const { container } = render(<Hero authUrl={AUTH} />);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});

	it("draws the silver and pearl ribbon behind the words, calmly, once the words are on screen", async () => {
		render(<Hero authUrl={AUTH} />);
		// The headline is there at once; the heavy background is loaded afterwards, on its own.
		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		const ribbon = await screen.findByTestId("ribbon");
		expect(ribbon).toHaveAttribute("data-field", "ribbon");
		expect(ribbon).toHaveAttribute("data-motion", "calm");
		expect(ribbon).toHaveAttribute("data-position", "absolute");
	});

	it("floats the pieces of the operating system around the words, as decoration only", () => {
		render(<Hero authUrl={AUTH} />);
		const tiles = screen.getByRole("region", { name: "Maschina" }).querySelectorAll("[data-tile]");
		expect([...tiles].map((tile) => tile.getAttribute("data-tile"))).toEqual([
			"Wallet",
			"Budget",
			"Rules",
			"Signer",
			"Record",
		]);
		for (const tile of tiles) {
			expect(tile).toHaveAttribute("aria-hidden", "true");
			expect(Number(tile.getAttribute("data-depth"))).toBeGreaterThan(0);
			expect(tile.className).not.toMatch(/rounded/);
			expect(tile.textContent?.length).toBeGreaterThan(20);
		}
	});

	it("moves the pieces with the cursor, each by its own depth, and settles when it leaves", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		section.getBoundingClientRect = () =>
			({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;

		fireEvent.pointerMove(section, { clientX: 1000, clientY: 400, pointerType: "mouse" });
		expect(section.style.getPropertyValue("--px")).toBe("1");
		expect(section.style.getPropertyValue("--py")).toBe("0");
		fireEvent.pointerMove(section, { clientX: 250, clientY: 800, pointerType: "mouse" });
		expect(section.style.getPropertyValue("--px")).toBe("-0.5");
		expect(section.style.getPropertyValue("--py")).toBe("1");

		fireEvent.pointerLeave(section);
		expect(section.style.getPropertyValue("--px")).toBe("0");
		expect(section.style.getPropertyValue("--py")).toBe("0");

		// A finger is not a cursor: touch moves nothing, only scrolling does.
		fireEvent.pointerMove(section, { clientX: 1000, clientY: 400, pointerType: "touch" });
		expect(section.style.getPropertyValue("--px")).toBe("0");
	});

	it("moves the pieces as the page scrolls", () => {
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
		fireEvent.scroll(window);
		expect(section.style.getPropertyValue("--sy")).toBe("300");
		Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
		fireEvent.scroll(window);
		expect(section.style.getPropertyValue("--sy")).toBe("0");
	});

	it("keeps everything still for anyone who asks their system for less motion", () => {
		const real = window.matchMedia;
		window.matchMedia = ((query: string) => ({
			matches: query.includes("reduce"),
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia;
		render(<Hero authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Maschina" });
		section.getBoundingClientRect = () =>
			({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
		fireEvent.pointerMove(section, { clientX: 1000, clientY: 400, pointerType: "mouse" });
		Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
		fireEvent.scroll(window);
		expect(section.style.getPropertyValue("--px")).toBe("");
		expect(section.style.getPropertyValue("--sy")).toBe("");
		window.matchMedia = real;
		Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
	});
});
