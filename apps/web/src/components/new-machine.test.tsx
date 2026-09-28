import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewMachineView, type RangeForm } from "./new-machine.tsx";

const ready: RangeForm = {
	name: "Range Finder",
	buyAt: "118.80",
	sellAt: "121.20",
	perBuy: "40.35",
	float: "40.6",
};

const view = (form: RangeForm, extra: { onCreate?: () => void; error?: string } = {}) =>
	render(
		<NewMachineView
			form={form}
			onChange={vi.fn()}
			onCreate={extra.onCreate ?? vi.fn()}
			creating={false}
			error={extra.error}
		/>,
	);

describe("creating a machine", () => {
	it("says what the band keeps, and creates when the form is ready", () => {
		const onCreate = vi.fn();
		view(ready, { onCreate });

		expect(screen.getByText(/2\.02% BAND/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "CREATE MACHINE" }));
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("will not create with a band too narrow to pay for itself", () => {
		view({ ...ready, sellAt: "119.00" });

		expect(screen.getByText(/TOO NARROW/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "CREATE MACHINE" })).toBeDisabled();
	});

	it("will not create a buy with no room left in the float for its fee", () => {
		view({ ...ready, perBuy: "40.6" });

		expect(screen.getByText("AT MOST 40.35 OF A 40.6 FLOAT")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "CREATE MACHINE" })).toBeDisabled();
	});

	it("says why when the API refuses", () => {
		view(ready, { error: "the policy did not read back" });

		expect(screen.getByRole("alert")).toHaveTextContent("the policy did not read back");
	});
});
