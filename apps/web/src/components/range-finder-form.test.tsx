import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const drawn: unknown[] = [];
vi.mock("./price-chart.tsx", () => ({
	PriceChart: ({ levels }: { levels: unknown }) => {
		drawn.push(levels);
		return null;
	},
}));

const { RangeFinderForm } = await import("./range-finder-form.tsx");
const form = {
	name: "",
	float: "40.60",
	bandPct: 2,
	floorPct: 5 as const,
	afterFloor: "carry_on" as const,
};

describe("the Range Finder's controls", () => {
	it("draws the follow, buy and floor lines around the live price", () => {
		render(<RangeFinderForm form={form} price={120} onChange={vi.fn()} />);

		const lines = drawn.at(-1) as { price: number; label: string }[];
		expect(lines.map((line) => line.label)).toEqual(["FOLLOW", "BUY", "FLOOR"]);
		expect(lines[1]?.price).toBeCloseTo(118.8);
		expect(lines[2]?.price).toBeCloseTo(112.86);
	});

	it("chooses the floor and what happens after it", () => {
		const onChange = vi.fn();
		render(<RangeFinderForm form={form} price={120} onChange={onChange} />);

		fireEvent.click(screen.getByRole("button", { name: "3%" }));
		expect(onChange).toHaveBeenCalledWith({ ...form, floorPct: 3 });
		fireEvent.click(screen.getByRole("button", { name: "PAUSE UNTIL I LOOK" }));
		expect(onChange).toHaveBeenCalledWith({ ...form, afterFloor: "pause" });
	});

	it("cannot be created until its backend ships", () => {
		render(<RangeFinderForm form={form} price={120} onChange={vi.fn()} />);

		expect(screen.getByRole("button", { name: "CREATE RANGE FINDER" })).toBeDisabled();
	});
});
