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

	it("has the hero, then the app showcase, then how it works, then the closing section, then the footer", () => {
		render(<Site authUrl="https://auth.maschina.dev" />);
		const main = screen.getByRole("main");
		const hero = within(main).getByRole("region", { name: "Maschina" });
		const app = within(main).getByRole("region", { name: "The app" });
		const how = within(main).getByRole("region", { name: "How it works" });
		const closing = within(main).getByRole("region", { name: "Get started" });
		expect(hero.nextElementSibling).toBe(app);
		expect(app.nextElementSibling).toBe(how);
		expect(how.nextElementSibling).toBe(closing);
		// Plain sections, one after the other: nothing is pinned and nothing rolls over anything.
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
