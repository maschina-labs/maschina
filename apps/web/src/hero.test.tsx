import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
