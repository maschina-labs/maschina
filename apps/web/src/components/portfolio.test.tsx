import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MachineSummary } from "../lib/machines.ts";
import { ActivityView, BreakdownView, sharesOf, TotalsView } from "./portfolio.tsx";

describe("portfolio totals", () => {
	it("shows what is in play, taken, held and running", () => {
		render(
			<TotalsView
				totals={{
					machines: 2,
					running: 1,
					granted: 68_600_000n,
					realised: 250_000n,
					holding: 2_000_000_000n,
					trades: 4,
					simulated: false,
				}}
			/>,
		);

		expect(screen.getByText("68.60 USDC")).toBeInTheDocument();
		expect(screen.getByText("0.25 USDC")).toBeInTheDocument();
		expect(screen.getByText("2.00 SOL")).toBeInTheDocument();
		expect(screen.getByText("1 OF 2")).toBeInTheDocument();
	});

	it("says when paper machines are in the numbers", () => {
		render(
			<TotalsView
				totals={{
					machines: 1,
					running: 1,
					granted: 1n,
					realised: 0n,
					holding: 0n,
					trades: 0,
					simulated: true,
				}}
			/>,
		);

		expect(screen.getByText("INCLUDES PAPER MACHINES")).toBeInTheDocument();
	});
});

describe("activity", () => {
	it("names the machine beside each event", () => {
		render(
			<ActivityView
				feed={[
					{
						id: "1",
						type: "trade.completed",
						occurredAt: "2026-09-28T07:00:00Z",
						payload: {},
						machineId: "a",
						machineName: "Range Finder",
					},
				]}
			/>,
		);

		expect(screen.getByText("TRADE.COMPLETED")).toBeInTheDocument();
		expect(screen.getByText("Range Finder")).toBeInTheDocument();
	});

	it("says so when nothing has happened", () => {
		render(<ActivityView feed={[]} />);

		expect(screen.getByText("NOTHING YET")).toBeInTheDocument();
	});
});

const machine = (machineId: string, granted: string) =>
	({
		machineId,
		name: `Machine ${machineId}`,
		state: "running",
		budget: { granted },
		result: { realised: "0", trades: 0 },
	}) as unknown as MachineSummary;

describe("where the money is", () => {
	it("gives each machine its share of what is in play", () => {
		expect(sharesOf([machine("a", "30000000"), machine("b", "10000000")])).toEqual([
			{ machineId: "a", share: 75 },
			{ machineId: "b", share: 25 },
		]);
	});

	it("gives nobody a share when nothing is in play", () => {
		expect(sharesOf([machine("a", "0")])).toEqual([{ machineId: "a", share: 0 }]);
	});

	it("shows each machine's share and figures", () => {
		render(<BreakdownView machines={[machine("a", "30000000"), machine("b", "10000000")]} />);

		expect(screen.getByText("75.0% OF IN PLAY")).toBeInTheDocument();
		expect(screen.getByText("FLOAT 30.00")).toBeInTheDocument();
	});
});
