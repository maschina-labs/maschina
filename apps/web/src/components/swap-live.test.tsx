import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	mutate: vi.fn(),
	navigate: vi.fn(),
	fetchQuote: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
	useNavigate: () => state.navigate,
}));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useCreateMachine: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock("../lib/price.ts", () => ({ fetchPrice: async () => ({ usd: 120 }) }));
vi.mock("../lib/quote.ts", () => ({ fetchQuote: state.fetchQuote }));

const { Swap } = await import("./swap.tsx");

const mount = () =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<Swap />
		</QueryClientProvider>,
	);

beforeEach(() => {
	state.mutate.mockReset();
	state.navigate.mockReset();
	state.fetchQuote.mockReset();
	state.fetchQuote.mockResolvedValue({
		out: 0.08453,
		atLeast: 0.0841,
		impactPct: 0.1,
		route: ["Orca"],
	});
});

describe("swapping at the market", () => {
	it("quotes what you would get once you stop typing", async () => {
		mount();
		fireEvent.change(screen.getByRole("textbox", { name: /YOU PAY/ }), { target: { value: "10" } });

		await waitFor(() => expect(state.fetchQuote).toHaveBeenCalledWith("USDC", "SOL", 10));
		expect(await screen.findByText("0.08453")).toBeInTheDocument();
	});

	it("turns the swap around", () => {
		mount();
		fireEvent.click(screen.getByRole("button", { name: "Swap direction" }));

		expect(screen.getAllByText("USDC").length).toBeGreaterThan(0);
		expect(screen.getByRole("button", { name: "SWAP" })).toBeDisabled();
	});
});

describe("a limit order", () => {
	it("starts two percent under the price, and makes a real machine", async () => {
		mount();
		fireEvent.click(screen.getByRole("button", { name: "LIMIT" }));

		await waitFor(() =>
			expect(screen.getByRole("textbox", { name: /FALLS TO/ })).toHaveValue("117.60"),
		);
		const make = screen.getByRole("button", { name: "MAKE THIS A MACHINE" });
		expect(make).toBeDisabled();
		fireEvent.change(screen.getByRole("textbox", { name: /SPEND/ }), { target: { value: "20" } });
		fireEvent.click(make);

		expect(state.mutate).toHaveBeenCalledOnce();
		const [request, handlers] = state.mutate.mock.calls[0] ?? [];
		expect(request).toMatchObject({ paper: true });
		handlers.onSuccess({ machineId: "m1" });
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/machines/$machineId",
			params: { machineId: "m1" },
		});
		handlers.onError(new Error("no"));
	});
});

describe("a recurring buy", () => {
	it("lets you choose how often, while making one waits on the backend", () => {
		mount();
		fireEvent.click(screen.getByRole("button", { name: "RECURRING" }));
		fireEvent.click(screen.getByRole("button", { name: "EVERY WEEK" }));

		expect(screen.getByRole("button", { name: "EVERY WEEK" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "MAKE THIS A MACHINE" })).toBeDisabled();
	});
});
