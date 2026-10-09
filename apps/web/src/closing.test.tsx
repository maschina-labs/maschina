import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Closing } from "./closing.tsx";

const AUTH = "https://auth.maschina.dev";

describe("the closing call to action", () => {
	it("says what it costs to try, in two plain lines", () => {
		render(<Closing authUrl={AUTH} />);
		const section = screen.getByRole("region", { name: "Get started" });
		expect(
			within(section).getByRole("heading", { level: 2, name: "Try a machine on paper first." }),
		).toBeInTheDocument();
		expect(
			within(section).getByText("It costs nothing to try. Move to real money when you trust it."),
		).toBeInTheDocument();
	});

	it("has the two buttons: start for free, and the docs", () => {
		render(<Closing authUrl={AUTH} />);
		const section = within(screen.getByRole("region", { name: "Get started" }));
		expect(section.getByRole("link", { name: "Start for free" })).toHaveAttribute(
			"href",
			`${AUTH}/sign-up`,
		);
		expect(section.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", "/docs");
	});

	it("is pearl white, never flat white, and sits above the pinned hero so it rolls over it", () => {
		render(<Closing authUrl={AUTH} />);
		const { className } = screen.getByRole("region", { name: "Get started" });
		expect(className).toContain("bg-[oklch(0.95_0.012_300)]");
		expect(className).not.toMatch(/bg-white/);
		expect(className).toContain("relative");
		expect(className).toContain("z-10");
		expect(className).toContain("px-(--gutter)");
		expect(className).toContain("text-center");
	});

	it("has black buttons, because pearl ones would vanish on pearl", () => {
		render(<Closing authUrl={AUTH} />);
		const start = screen.getByRole("link", { name: "Start for free" });
		expect(start.className).toContain("bg-black");
		expect(start.className).not.toContain("bg-[oklch(0.93_0.02_300)]");
		// The chip is the pearl now, with a black chevron.
		const chip = start.querySelector("[data-chip]") as HTMLElement;
		expect(chip.className).toContain("bg-[oklch(0.93_0.02_300)]");
		expect(chip.className).toContain("text-black");
		const docs = screen.getByRole("link", { name: "Read the docs" });
		expect(docs.className).toContain("bg-black/[0.07]");
		expect(docs.className).not.toMatch(/rounded/);
	});

	it("has no rounded corners anywhere", () => {
		const { container } = render(<Closing authUrl={AUTH} />);
		expect(container.innerHTML).not.toMatch(/rounded/);
	});
});
