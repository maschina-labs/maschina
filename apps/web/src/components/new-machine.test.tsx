import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The preview chart draws on a canvas; here only what it is told to draw matters.
const drawn: unknown[] = [];
vi.mock("./price-chart.tsx", () => ({
	PriceChart: ({ levels }: { levels: unknown }) => {
		drawn.push(levels);
		return null;
	},
}));

const { NewMachineView, startingBand } = await import("./new-machine.tsx");
type Form = Parameters<typeof NewMachineView>[0]["form"];

const ready: Form = {
	name: "Range Finder",
	buyAt: "118.80",
	sellAt: "121.20",
	perBuy: "40.35",
	float: "40.60",
};

const view = (
	form: Form,
	extra: { onCreate?: () => void; onChange?: (form: Form) => void; error?: string } = {},
) =>
	render(
		<NewMachineView
			form={form}
			price={119.7}
			onChange={extra.onChange ?? vi.fn()}
			onCreate={extra.onCreate ?? vi.fn()}
			creating={false}
			error={extra.error}
		/>,
	);

describe("creating a machine", () => {
	it("starts the band just under the live price, two percent wide", () => {
		expect(startingBand(119.7)).toEqual({ buyAt: "118.74", sellAt: "121.12" });
	});

	it("says what the band keeps, previews it on the chart, and creates when ready", () => {
		const onCreate = vi.fn();
		view(ready, { onCreate });

		expect(screen.getByText(/2\.02% BAND · KEEPS ABOUT/)).toBeInTheDocument();
		expect(drawn.at(-1)).toEqual([
			{ price: 121.2, label: "SELL" },
			{ price: 118.8, label: "BUY" },
		]);
		fireEvent.click(screen.getByRole("button", { name: "CREATE MACHINE" }));
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("moves the band when a slider is dragged", () => {
		const onChange = vi.fn();
		view(ready, { onChange });

		fireEvent.change(screen.getByRole("slider", { name: "BUY SOL AT" }), {
			target: { value: "118.5" },
		});
		expect(onChange).toHaveBeenCalledWith({ ...ready, buyAt: "118.50" });
	});

	it("will not create with a band too narrow to pay for itself", () => {
		view({ ...ready, sellAt: "119.00" });

		expect(screen.getByText(/TOO NARROW/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "CREATE MACHINE" })).toBeDisabled();
	});

	it("says why when the API refuses", () => {
		view(ready, { error: "the policy did not read back" });

		expect(screen.getByRole("alert")).toHaveTextContent("the policy did not read back");
	});
});
