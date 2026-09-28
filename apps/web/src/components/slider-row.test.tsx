import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fillOf, SliderRow, TypeRow } from "./slider-row.tsx";

describe("a slider row", () => {
	it("fills to where the value sits in its range", () => {
		expect(fillOf(118.8, 110, 130)).toBeCloseTo(0.44);
		expect(fillOf(200, 110, 130)).toBe(1);
		expect(fillOf(5, 10, 10)).toBe(0);
	});

	it("reads its value and changes it like a slider", () => {
		const onChange = vi.fn();
		render(
			<SliderRow
				label="BUY AT"
				value={118.8}
				min={110}
				max={130}
				step={0.01}
				shown="118.80"
				onChange={onChange}
			/>,
		);

		const slider = screen.getByRole("slider", { name: "BUY AT" });
		expect(slider).toHaveAttribute("aria-valuetext", "118.80");
		fireEvent.change(slider, { target: { value: "119.5" } });
		expect(onChange).toHaveBeenCalledWith(119.5);
	});
});

describe("a typed row", () => {
	it("takes what is typed", () => {
		const onChange = vi.fn();
		render(<TypeRow label="NAME" value="" onChange={onChange} />);

		fireEvent.change(screen.getByRole("textbox", { name: "NAME" }), {
			target: { value: "Range Finder" },
		});
		expect(onChange).toHaveBeenCalledWith("Range Finder");
	});
});
