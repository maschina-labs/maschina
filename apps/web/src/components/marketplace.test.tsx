import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineSummary } from "../lib/machines.ts";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => <a href="/machines">{children}</a>,
}));

const { MarketplaceView, winRate } = await import("./marketplace.tsx");

const machine = (wins: number, losses: number) =>
	({
		machineId: "m",
		name: "Paper range SOL",
		kind: "range",
		result: { realised: "630000", trades: 4, wins, losses, simulated: true },
	}) as unknown as MachineSummary;

describe("the marketplace", () => {
	it("gives the share of round trips that made money", () => {
		expect(winRate(machine(3, 1))).toBe("75%");
		expect(winRate(machine(0, 0))).toBe("-");
	});

	it("lists a machine with its real record, and says whether that record is paper", () => {
		render(<MarketplaceView machines={[machine(1, 1)]} />);

		expect(screen.getByText("PAPER RANGE SOL")).toBeInTheDocument();
		expect(screen.getByText("0.63")).toBeInTheDocument();
		expect(screen.getByText("RECORD ON PAPER")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "COPY" })).toBeDisabled();
	});
});
