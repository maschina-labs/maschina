import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
}));
vi.mock("@tanstack/react-query", async (real) => ({
	...(await real<object>()),
	useQueries: () => [
		{
			data: {
				machineId: "a",
				name: "Range Finder",
				state: "running",
				settings: { buyLevel: "118800000", sellLevel: "121200000" },
				result: { position: "0" },
			},
		},
		{ data: undefined },
	],
}));
vi.mock("../lib/session.ts", () => ({ useSession: () => ({ data: { ownerId: "o" } }) }));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useMachines: () => ({ data: [{ machineId: "a" }, { machineId: "b" }] }),
}));
vi.mock("./portfolio.tsx", () => ({
	useMachineTrades: () => [
		{ machine: "RANGE FINDER", at: 1790560000000, side: "sell", price: 121.75 },
	],
}));

const { HoldingsTabs } = await import("./holdings-tabs.tsx");

describe("orders, history and holdings", () => {
	it("shows what each machine waits to do, every trade, and your holdings", () => {
		render(<HoldingsTabs />);
		expect(screen.getByText("WAITING TO BUY AT 118.80")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "HISTORY" }));
		expect(screen.getByText("RANGE FINDER · SOLD")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "HOLDINGS" }));
		expect(screen.getByRole("button", { name: "HOLDINGS" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});
});
