import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KindPicker, PaperOrLive } from "./kind-picker.tsx";

describe("picking a kind of machine", () => {
	it("offers every kind, marks those not ready, and picks one", () => {
		const onChoose = vi.fn();
		render(<KindPicker chosen="range" onChoose={onChoose} />);

		expect(screen.getByRole("button", { name: /FIXED RANGE/ })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: /RANGE FINDER/ })).not.toHaveTextContent("COMING");
		expect(screen.getByRole("button", { name: /GRID/ })).toHaveTextContent("COMING");
		fireEvent.click(screen.getByRole("button", { name: /GRID/ }));
		expect(onChoose).toHaveBeenCalledWith("grid");
	});
});

describe("paper or live", () => {
	it("switches between the free tutorial and real money", () => {
		const onChange = vi.fn();
		render(<PaperOrLive paper onChange={onChange} />);

		expect(screen.getByRole("button", { name: /PAPER/ })).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(screen.getByRole("button", { name: /LIVE/ }));
		expect(onChange).toHaveBeenCalledWith(false);
	});
});
