import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineSummary } from "../lib/machines.ts";
import { FleetView } from "./fleet.tsx";

const machine = (machineId: string, name: string, state: MachineSummary["state"]) =>
	({ machineId, name, state, kind: "range" }) as MachineSummary;

describe("the fleet", () => {
	it("lists each machine with its state, and says which is selected", () => {
		render(
			<FleetView
				machines={[machine("a", "Range Finder", "running"), machine("b", "SOL range", "stopped")]}
				selected="a"
				onSelect={vi.fn()}
			/>,
		);

		const rows = screen.getAllByRole("button");
		expect(rows.map((row) => row.textContent)).toEqual(["Range FinderRUNNING", "SOL rangeSTOPPED"]);
		expect(rows[0]).toHaveAttribute("aria-current", "true");
	});

	it("selects a machine when it is pressed", () => {
		const onSelect = vi.fn();
		render(
			<FleetView
				machines={[machine("a", "Range Finder", "running")]}
				selected={undefined}
				onSelect={onSelect}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Range Finder/ }));
		expect(onSelect).toHaveBeenCalledWith("a");
	});

	it("says so when there are none", () => {
		render(<FleetView machines={[]} selected={undefined} onSelect={vi.fn()} />);

		expect(screen.getByText("NO MACHINES YET")).toBeInTheDocument();
	});
});
