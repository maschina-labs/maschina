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
const form = { name: "", float: "40.60", bandPct: 2, floorPct: 5 as const };
const props = { price: 120, paper: true, creating: false, onCreate: vi.fn() };

describe("the Range Finder's controls", () => {
	it("draws the follow, buy and floor lines around the live price", () => {
		render(<RangeFinderForm form={form} {...props} onChange={vi.fn()} />);

		const lines = drawn.at(-1) as { price: number; label: string }[];
		expect(lines.map((line) => line.label)).toEqual(["FOLLOW", "BUY", "FLOOR"]);
		expect(lines[1]?.price).toBeCloseTo(118.8);
		expect(lines[2]?.price).toBeCloseTo(112.86);
	});

	it("chooses the floor, as tight as three percent or as loose as eight", () => {
		const onChange = vi.fn();
		render(<RangeFinderForm form={form} {...props} onChange={onChange} />);

		fireEvent.click(screen.getByRole("button", { name: "3%" }));
		expect(onChange).toHaveBeenCalledWith({ ...form, floorPct: 3 });
		fireEvent.click(screen.getByRole("button", { name: "8%" }));
		expect(onChange).toHaveBeenCalledWith({ ...form, floorPct: 8 });
		// After the floor it rests an hour and carries on; that is the only way it works.
		expect(screen.queryByRole("button", { name: "PAUSE UNTIL I LOOK" })).not.toBeInTheDocument();
	});

	it("waits for a name, then creates", () => {
		const onCreate = vi.fn();
		const { rerender } = render(
			<RangeFinderForm form={form} {...props} onCreate={onCreate} onChange={vi.fn()} />,
		);
		expect(screen.getByRole("button", { name: "CREATE PAPER RANGE FINDER" })).toBeDisabled();

		rerender(
			<RangeFinderForm
				form={{ ...form, name: "Range Finder" }}
				{...props}
				paper={false}
				onCreate={onCreate}
				onChange={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "CREATE RANGE FINDER" }));
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("says why it could not be made", () => {
		render(<RangeFinderForm form={form} {...props} error="budget too big" onChange={vi.fn()} />);
		expect(screen.getByRole("alert")).toHaveTextContent("budget too big");
	});
});
