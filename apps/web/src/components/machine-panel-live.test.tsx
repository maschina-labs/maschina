import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The panel as the machine page mounts it: reading the API through the machine hooks.
const state = vi.hoisted(() => ({
	machine: {} as { data?: unknown; error?: unknown },
	record: [] as unknown[],
	mutate: vi.fn(),
	withdraw: vi.fn(),
	fund: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));
vi.mock("@tanstack/react-query", async (real) => ({
	...(await real<object>()),
	useQuery: () => ({ data: { usd: 120 } }),
	useQueryClient: () => ({}),
}));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useMachine: () => state.machine,
	useRecord: () => ({ data: state.record }),
	useBalances: () => ({ data: undefined }),
	useFund: () => ({ mutate: state.fund, isPending: false, error: null }),
	useMachineAction: () => ({ mutate: state.mutate, isPending: false, error: null }),
	useWithdrawEverything: () => ({ mutate: state.withdraw, isPending: false, error: null }),
}));

const { ApiError } = await import("../lib/machines.ts");
const { MachinePanel } = await import("./machine-panel.tsx");

const detail = {
	machineId: "m",
	name: "Range Finder",
	kind: "range",
	state: "running",
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
	settings: { buyLevel: "118800000", sellLevel: "121200000" },
	limits: { approvedMints: [] },
	actions: ["pause", "stop"],
};

beforeEach(() => {
	state.machine = { data: detail };
	state.record = [];
	state.mutate.mockReset();
});

describe("the machine page's panel", () => {
	it("lists the record newest first, the way the API sends it", () => {
		state.record = [
			{ id: "b", type: "machine.paused", occurredAt: "2026-09-28T19:22:09Z", payload: {} },
			{ id: "a", type: "machine.started", occurredAt: "2026-09-28T05:22:33Z", payload: {} },
		];
		render(<MachinePanel machineId="m" />);

		const rows = within(screen.getByRole("region", { name: "Record" })).getAllByRole("listitem");
		expect(rows[0]).toHaveTextContent("PAUSED");
		expect(rows[1]).toHaveTextContent("STARTED");
	});

	it("sends an action to the API once it is confirmed", () => {
		render(<MachinePanel machineId="m" />);

		fireEvent.click(screen.getByRole("button", { name: "PAUSE" }));
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "PAUSE" }));
		expect(state.mutate).toHaveBeenCalledWith({ action: "pause" }, expect.anything());
	});

	it("says a machine is somebody else's rather than showing an error", () => {
		state.machine = { error: new ApiError("no such machine", 404) };
		render(<MachinePanel machineId="m" />);

		expect(screen.getByText("THIS MACHINE BELONGS TO SOMEONE ELSE")).toBeInTheDocument();
	});

	it("asks you to connect again when the session has ended", () => {
		state.machine = { error: new ApiError("sign in", 401) };
		render(<MachinePanel machineId="m" />);

		expect(screen.getByText("CONNECT AGAIN")).toBeInTheDocument();
	});

	it("shows any other problem as it is", () => {
		state.machine = { error: new Error("the gateway is down") };
		render(<MachinePanel machineId="m" />);

		expect(screen.getByRole("alert")).toHaveTextContent("the gateway is down");
	});

	it("says it is loading until the machine arrives", () => {
		state.machine = {};
		render(<MachinePanel machineId="m" />);

		expect(screen.getByText("LOADING THE MACHINE")).toBeInTheDocument();
	});
});

describe("funding from the machine page", () => {
	it("asks the wallet with the budget the machine already has", () => {
		render(<MachinePanel machineId="m" />);
		fireEvent.click(screen.getByRole("button", { name: "FUND FROM MY WALLET" }));
		expect(state.fund).toHaveBeenCalledWith(
			{ usdc: "0", lamports: "12000000", granted: "40600000" },
			expect.anything(),
		);
		const [, handlers] = state.fund.mock.calls[0] ?? [];
		handlers.onSuccess();
		handlers.onError(new Error("User rejected the request."));
	});
});
