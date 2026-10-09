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
			name: "Ready to build your first machine?",
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
		// The gradient only paints inside the heading's box, so the box has room below the letters for the tails of
		// y, p and g, and the same room is taken back from the margin so nothing moves.
		expect(heading.className).toContain("pb-[0.14em]");
		expect(heading.className).toContain("-mb-[0.14em]");
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

	it("has stage lights along its bottom edge, shining up from the seam with the footer onto the buttons", () => {
		const { container } = render(<Closing authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Get started" });
		const lights = container.querySelector("[data-stage-lights]") as HTMLElement;
		expect(lights).toHaveAttribute("aria-hidden", "true");
		expect(lights.className).toContain("pointer-events-none");
		expect(lights.className).toContain("absolute");
		expect(lights.className).toContain("inset-x-0");
		expect(lights.className).toContain("bottom-0");
		expect(section.className).toContain("overflow-hidden");
		// Four soft cones, each angled up from a point on the bottom edge, over a low glow along the edge.
		expect(lights.className.match(/conic-gradient\(from_[-\d.]+deg_at_\d+%_100%/g)).toHaveLength(4);
		expect(lights.className).toMatch(/radial-gradient\([^)]*at_50%_100%/);
		// The light is gentle (no stop is stronger than 16% white) and fades out as it rises, so it never reaches
		// the words.
		const strengths = [...lights.className.matchAll(/oklch\([\d._]+\/0\.(\d+)\)/g)].map((m) =>
			Number(`0.${m[1]}`),
		);
		expect(strengths.length).toBeGreaterThanOrEqual(5);
		for (const strength of strengths) expect(strength).toBeLessThanOrEqual(0.16);
		expect(lights.className).toContain("[mask-image:linear-gradient(to_top,black,transparent)]");
		expect(lights.className).toMatch(/h-\[\d+%\]/);
		// It sits behind the headline and the buttons, and does not move.
		expect(lights.className).not.toMatch(/animate-|transition-/);
		expect(screen.getByRole("heading", { level: 2 }).className).toContain("relative");
	});
});
