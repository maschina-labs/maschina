import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
}));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useCreateMachine: () => ({ mutate: state.mutate, isPending: false, error: null }),
}));
vi.mock("../lib/price.ts", () => ({ fetchPrice: async () => ({ usd: 120 }) }));
vi.mock("./price-chart.tsx", () => ({ PriceChart: () => null }));

const { NewMachine } = await import("./new-machine.tsx");

const mount = (onCreated = vi.fn()) =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<NewMachine onCreated={onCreated} />
		</QueryClientProvider>,
	);
const type = (name: RegExp, value: string) =>
	fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });

beforeEach(() => state.mutate.mockReset());

describe("making a machine", () => {
	it("starts on a Range Finder on paper, and makes one", () => {
		const onCreated = vi.fn();
		mount(onCreated);
		type(/NAME/, "Range Finder");
		type(/FLOAT/, "40.60");
		fireEvent.click(screen.getByRole("button", { name: "CREATE PAPER RANGE FINDER" }));

		const [request, handlers] = state.mutate.mock.calls[0] ?? [];
		expect(request).toMatchObject({ paper: true, settings: { bandBps: 200, floorBps: 500 } });
		handlers.onSuccess({ machineId: "m1" });
		expect(onCreated).toHaveBeenCalledWith("m1");
	});

	it("makes a fixed range too, with its band starting under the live price", async () => {
		const onCreated = vi.fn();
		mount(onCreated);
		fireEvent.click(screen.getByRole("button", { name: /FIXED RANGE/ }));
		await waitFor(() => expect(screen.getByText(/% BAND/)).toBeInTheDocument());
		type(/NAME/, "Fixed");
		type(/FLOAT/, "40.60");
		fireEvent.click(screen.getByRole("button", { name: /LIVE · REAL MONEY/ }));
		fireEvent.click(screen.getByRole("button", { name: "CREATE MACHINE" }));

		const [request, handlers] = state.mutate.mock.calls[0] ?? [];
		expect(request).toMatchObject({ paper: false, settings: { buyLevel: expect.any(String) } });
		handlers.onSuccess({ machineId: "m2" });
		expect(onCreated).toHaveBeenCalledWith("m2");
	});

	it("says what a kind earns while it is not built yet", () => {
		mount();
		fireEvent.click(screen.getByRole("button", { name: /GRID/ }));
		expect(screen.getByText(/ITS CONTROLS ARRIVE WHEN THE KIND IS BUILT/)).toBeInTheDocument();
	});
});
