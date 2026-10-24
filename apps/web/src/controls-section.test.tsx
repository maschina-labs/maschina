import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ControlsSection } from "./controls-section.tsx";

describe("machine control examples", () => {
	it("updates examples without configuring a real machine", () => {
		render(<ControlsSection />);
		fireEvent.change(screen.getByRole("slider", { name: /Range width/ }), {
			target: { value: "4" },
		});
		expect(screen.getAllByText("±4.0%")).toHaveLength(2);
		fireEvent.change(screen.getByRole("slider", { name: /Amount per buy/ }), {
			target: { value: "60" },
		});
		expect(screen.getByText("60 USDC")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Pause example" }));
		expect(screen.getByRole("button", { name: "Resume example" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByText("Paused")).toBeInTheDocument();
		expect(screen.getByText(/do not configure a real machine/)).toBeInTheDocument();
	});
	it("shows every card in a vertical stack without carousel navigation", () => {
		render(<ControlsSection />);
		const group = screen.getByRole("group", { name: "Explore machine controls" });
		expect(group).toHaveClass("flex-col");
		expect(group.querySelectorAll("article")).toHaveLength(3);
		expect(screen.queryByRole("button", { name: "Next control" })).not.toBeInTheDocument();
		expect(group).not.toHaveAttribute("tabindex");
	});
});
