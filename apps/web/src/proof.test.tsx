import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Proof } from "./proof.tsx";

describe("the proof section", () => {
	it("is a labelled section with a heading, and a link to the live record", () => {
		render(<Proof />);
		const section = screen.getByRole("region", { name: "Proof" });
		expect(
			within(section).getByRole("heading", { level: 2, name: "The record is public." }),
		).toBeInTheDocument();
		expect(within(section).getByRole("link", { name: "See the live record" })).toHaveAttribute(
			"href",
			"/live",
		);
	});

	it("says three things that are true, as three square boxes", () => {
		render(<Proof />);
		const section = screen.getByRole("region", { name: "Proof" });
		const items = within(section).getAllByRole("listitem");
		expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
			"Since September 28",
			"On chain",
			"Outside the AI",
		]);
		for (const item of items) expect(item.className).not.toMatch(/rounded/);
		expect(section.innerHTML).not.toMatch(/rounded/);
	});

	it("has its own top edge, so it reads as the next section as it peeks in under the hero", () => {
		render(<Proof />);
		const section = screen.getByRole("region", { name: "Proof" });
		expect(section.className).toContain("border-t");
		expect(section.className).toContain("px-(--gutter)");
	});
});
