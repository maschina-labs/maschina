import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Closing } from "./closing.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the closing section", () => {
	it("asks you to build your first machine, says it can be tried on paper first, and has two buttons", () => {
		render(<Closing authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Get started" });
		const heading = within(section).getByRole("heading", {
			level: 2,
			name: "Build your first machine.",
		});
		const subtext = within(section).getByText("Test it on paper first, with no money at risk.");
		// Nothing else to read: the headline, one short line under it, and the buttons.
		expect(section.querySelectorAll("p")).toHaveLength(1);
		expect(heading.nextElementSibling).toBe(subtext);
		expect(subtext.className).toContain("text-neutral-400");
		expect(subtext.className).toContain("mt-5");
		expect(within(section).getByRole("link", { name: "Start for free" })).toHaveAttribute(
			"href",
			`${AUTH}/sign-up`,
		);
		expect(within(section).getByRole("link", { name: "Read the docs" })).toHaveAttribute(
			"href",
			"/docs",
		);
	});

	it("has the hero's headline in silver and the hero's two buttons", () => {
		render(<Closing authUrl={AUTH} />);
		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading.className).toContain("bg-clip-text");
		expect(heading.className).toContain("text-transparent");
		expect(heading.className).toContain("linear-gradient(105deg");
		const start = screen.getByRole("link", { name: "Start for free" });
		expect(start.className).toContain("bg-[oklch(0.93_0.02_300)]");
		expect(start.className).toContain("h-9");
		expect(start.querySelector("[data-chip]")?.className).toContain("size-7");
		const docs = screen.getByRole("link", { name: "Read the docs" });
		expect(docs.className).toMatch(/\bbg-white\/\[0\.13\]/);
		expect(docs.className).toContain("h-9");
	});

	it("is centered on black and a full screen of calm: no particles, no canvas, no motion", () => {
		const { container } = render(<Closing authUrl={AUTH} />);
		const { className } = screen.getByRole("region", { name: "Get started" });
		expect(className).toContain("bg-black");
		expect(className).toContain("min-h-[70dvh]");
		expect(className).toContain("flex-col");
		expect(className).toContain("items-center");
		expect(className).toContain("justify-center");
		expect(className).toContain("text-center");
		expect(className).toContain("px-(--gutter)");
		expect(container.querySelector("canvas")).toBeNull();
		expect(container.innerHTML).not.toMatch(/animate-/);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
