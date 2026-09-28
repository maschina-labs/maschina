import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MachineDetail } from "../lib/machines.ts";
import { HistoryView, OrdersView } from "./holdings-tabs.tsx";

const machine = (state: MachineDetail["state"], position = "0") =>
	({
		machineId: state,
		name: "Range Finder",
		state,
		settings: { buyLevel: "118800000", sellLevel: "121200000" },
		result: { position },
	}) as unknown as MachineDetail;

describe("orders and history", () => {
	it("lists what running machines are waiting to do", () => {
		render(<OrdersView machines={[machine("running", "339698000"), machine("stopped")]} />);

		expect(screen.getAllByRole("listitem")).toHaveLength(1);
		expect(screen.getByText("HOLDING · SELLS AT 121.20")).toBeInTheDocument();
	});

	it("lists every trade", () => {
		render(
			<HistoryView
				trades={[{ machine: "RANGE FINDER", at: 1790560000000, side: "buy", price: 118.78 }]}
			/>,
		);

		expect(screen.getByText("RANGE FINDER · BOUGHT")).toBeInTheDocument();
		expect(screen.getByText("AT 118.78")).toBeInTheDocument();
	});

	it("says when there is nothing", () => {
		render(<OrdersView machines={[]} />);
		expect(screen.getByText("NO MACHINE IS WAITING TO TRADE")).toBeInTheDocument();
	});
});
