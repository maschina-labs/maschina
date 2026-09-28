import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: unknown }) => options,
	useRouter: () => ({ options: { context: { api: {} } } }),
}));
vi.mock("../components/globe.tsx", () => ({ Globe: () => null }));
vi.mock("../components/coordinates.tsx", () => ({ Coordinates: () => null }));
vi.mock("../components/scramble.tsx", () => ({
	Scramble: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("../lib/session.ts", () => ({ useSession: () => ({ data: { ownerId: "o" } }) }));
vi.mock("../lib/machines.ts", () => ({
	useMachines: () => ({ data: [{ state: "running" }, { state: "stopped" }] }),
}));
vi.mock("../components/portfolio.tsx", () => ({
	useActivity: () => [
		{
			id: "1",
			type: "machine.started",
			occurredAt: "2026-09-28T05:22:33Z",
			payload: {},
			machineId: "m",
			machineName: "Range Finder",
		},
	],
}));

const { Route } = await import("./network.index.tsx");
const Page = (Route as unknown as { component: () => React.ReactNode }).component;

describe("the network page", () => {
	it("floats your machines' figures and a log over the globe", () => {
		render(<Page />);

		expect(screen.getByText("1 OF 2")).toBeInTheDocument();
		expect(screen.getByRole("list", { name: "Network log" })).toHaveTextContent("STARTED");
		expect(screen.getByRole("list", { name: "Network log" })).toHaveTextContent("RANGE FINDER");
	});
});
