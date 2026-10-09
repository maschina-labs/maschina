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

	it("has the hero, then what it is built with, then the closing section, then the footer", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const main = screen.getByRole("main");
		const hero = within(main).getByRole("region", { name: "Maschina" });
		const builtWith = within(main).getByRole("region", { name: "Built with" });
		const closing = within(main).getByRole("region", { name: "Get started" });
		expect(hero.nextElementSibling).toBe(builtWith);
		expect(builtWith.nextElementSibling).toBe(closing);
		// The hero is pinned inside the main, so the closing section rolls up over it; the footer follows.
		expect(main.nextElementSibling).toBe(screen.getByRole("contentinfo"));
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
