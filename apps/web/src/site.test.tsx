import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Site } from "./site.tsx";

beforeEach(() =>
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("{}", { status: 500 })),
	),
);

describe("the complete front page", () => {
	it("keeps the real header, product story, final action and footer connected", () => {
		render(<Site authUrl="/auth" />);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		const main = screen.getByRole("main");
		expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
			"The operating system for the machine economy.",
		);
		const sections = [...main.children].filter((node) => node.tagName === "SECTION");
		expect(sections).toHaveLength(12);
		expect(sections[0]).toHaveAttribute("aria-label", "Maschina");
		expect(sections.at(-1)).toHaveAttribute("aria-label", "Get Started");
		expect(main.nextElementSibling).toBe(screen.getByRole("contentinfo"));
		expect(within(main).getByRole("navigation", { name: "Explore Maschina" })).toBeInTheDocument();
		expect(within(main).getByRole("region", { name: "Paper mode" })).toBeInTheDocument();
	});
});
