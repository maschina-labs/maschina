import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineDetail } from "../lib/machines.ts";
import { MachinePanelView, placeInBand } from "./machine-panel.tsx";

const machine = (state: MachineDetail["state"], actions: MachineDetail["actions"]) =>
	({
		machineId: "m",
		name: "Range Finder",
		kind: "range",
		state,
		walletAddress: "6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy",
		createdAt: "2026-09-28T05:20:13Z",
		budget: { granted: "40600000", reserved: "0", settled: "0", available: "40600000" },
		result: {
			realised: "0",
			position: "0",
			basis: "0",
			feesLamports: "0",
			trades: 0,
			roundTrips: 0,
			wins: 0,
			losses: 0,
			simulated: false,
		},
		settings: { buyLevel: "118800000", sellLevel: "121200000", amountPerBuy: "40350000" },
		limits: { approvedMints: [] },
		actions,
	}) as MachineDetail;

const view = (
	detail: MachineDetail,
	handlers: { onAction?: () => void; onWithdraw?: () => void } = {},
) =>
	render(
		<MachinePanelView
			machine={detail}
			record={[
				{ id: "e", type: "machine.started", occurredAt: "2026-09-28T05:22:33Z", payload: {} },
			]}
			busy={false}
			onAction={handlers.onAction ?? vi.fn()}
			onWithdraw={handlers.onWithdraw ?? vi.fn()}
		/>,
	);

describe("the selected machine", () => {
	it("shows its band, what it spends, and its wallet", () => {
		view(machine("running", ["pause", "stop"]));

		expect(screen.getByText("BUY 118.80")).toBeInTheDocument();
		expect(screen.getByText("SELL 121.20")).toBeInTheDocument();
		expect(screen.getByText("EACH BUY 40.35 USDC")).toBeInTheDocument();
		expect(screen.getByText("WAITING TO BUY AT 118.80")).toBeInTheDocument();
		expect(screen.getByText("6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy")).toBeInTheDocument();
	});

	it("offers exactly the controls the API allows, and runs the one pressed", () => {
		const onAction = vi.fn();
		view(machine("running", ["pause", "stop"]), { onAction });

		expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["PAUSE", "STOP"]);
		fireEvent.click(screen.getByRole("button", { name: "STOP" }));
		expect(onAction).toHaveBeenCalledWith("stop");
	});

	it("offers to withdraw everything only once it has stopped acting", () => {
		const onWithdraw = vi.fn();
		view(machine("stopped", []), { onWithdraw });

		fireEvent.click(screen.getByRole("button", { name: "WITHDRAW EVERYTHING" }));
		expect(onWithdraw).toHaveBeenCalledOnce();
	});

	it("shows its record", () => {
		view(machine("running", []));

		expect(screen.getByText("STARTED")).toBeInTheDocument();
		expect(screen.getByText("WATCHING THE PRICE")).toBeInTheDocument();
	});

	it("marks the live price on the band meter", () => {
		render(
			<MachinePanelView
				machine={machine("running", [])}
				record={[]}
				price={120}
				busy={false}
				onAction={vi.fn()}
				onWithdraw={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("The price")).toHaveStyle({ left: "50%" });
	});
});

describe("where the price sits in the band", () => {
	it("is 0 at the buy line and 1 at the sell line", () => {
		expect(placeInBand(118.8, 118.8, 121.2)).toBe(0);
		expect(placeInBand(121.2, 118.8, 121.2)).toBe(1);
		expect(placeInBand(120, 118.8, 121.2)).toBeCloseTo(0.5);
	});

	it("stays on the track when the price leaves the band", () => {
		expect(placeInBand(100, 118.8, 121.2)).toBe(0);
		expect(placeInBand(150, 118.8, 121.2)).toBe(1);
	});

	it("never divides by a band with no width", () => {
		expect(placeInBand(120, 120, 120)).toBe(0);
	});
});
