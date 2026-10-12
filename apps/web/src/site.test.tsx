import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Site } from "./site.tsx";

describe("the front page", () => {
	// The footer's status mark asks the API: stand one in, so this test never reaches the network.
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
		);
	});

	it("has the hero, the marquee of what it is built with, the app showcase, the explaining sections, for builders, the questions, the closing section, then the footer", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const main = screen.getByRole("main");
		const names = [
			"Maschina",
			"Built With",
			"The App",
			"How It Works",
			"Inside the App",
			"Safety",
			"Customize",
			"Live Record",
			"Network",
			"Marketplace",
			"For Builders",
			"Questions",
			"Get Started",
		];
		const sections = names.map((name) => within(main).getByRole("region", { name }));
		for (const [index, section] of sections.entries()) {
			const next = sections[index + 1];
			if (next) expect(section.nextElementSibling).toBe(next);
		}
		// Plain sections, one after the other: nothing is pinned and nothing rolls over anything.
		expect(main.nextElementSibling).toBe(screen.getByRole("contentinfo"));
	});

	it("keeps the space between the text sections tighter on a phone, where a screen is short, and wide from a tablet up", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const main = screen.getByRole("main");
		for (const name of [
			"How It Works",
			"Inside the App",
			"Safety",
			"Customize",
			"Live Record",
			"Network",
			"Marketplace",
			"For Builders",
			"Questions",
		]) {
			const { className } = within(main).getByRole("region", { name });
			expect(className).toContain("py-20");
			expect(className).toContain("sm:py-32");
			expect(className).not.toMatch(/(^|\s)py-32/);
		}
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
