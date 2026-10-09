import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "./api.ts";
import { useFund } from "./machines.ts";

/** An API whose funding and actions answer as the gateway does, and remember what they were asked. */
function fakeApi(fundingStatus = 200) {
	const funding = vi.fn(
		async () =>
			new Response(JSON.stringify({ transaction: "AQID", lastValidBlockHeight: "1" }), {
				status: fundingStatus,
			}),
	);
	const actions = vi.fn(async () => new Response(JSON.stringify({ state: "running" })));
	const api = {
		v1: {
			machines: { ":machineId": { funding: { $post: funding }, actions: { $post: actions } } },
		},
	} as unknown as Api;
	return { api, funding, actions };
}

const client = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("funding a machine from your wallet", () => {
	it("builds it, has the wallet send it, then raises the budget by what was sent", async () => {
		const { api, funding, actions } = fakeApi();
		const send = vi.fn(async () => "5sig");
		const { result } = renderHook(() => useFund(api, client, "m", send), { wrapper });

		await act(async () => {
			await result.current.mutateAsync({
				usdc: "40350000",
				lamports: "12000000",
				granted: "40600000",
			});
		});

		expect(funding).toHaveBeenCalledWith({
			param: { machineId: "m" },
			json: { usdc: "40350000", lamports: "12000000" },
		});
		expect(send).toHaveBeenCalledWith("AQID");
		expect(actions).toHaveBeenCalledWith({
			param: { machineId: "m" },
			json: { action: "fund", budgetGranted: "80950000" },
		});
	});

	it("leaves the budget alone when only SOL is sent", async () => {
		const { api, actions } = fakeApi();
		const { result } = renderHook(() => useFund(api, client, "m", async () => "s"), { wrapper });
		await act(async () => {
			await result.current.mutateAsync({ usdc: "0", lamports: "12000000", granted: "0" });
		});
		expect(actions).not.toHaveBeenCalled();
	});

	it("changes nothing when the wallet says no", async () => {
		const { api, actions } = fakeApi();
		const send = vi.fn(async () => {
			throw new Error("User rejected the request.");
		});
		const { result } = renderHook(() => useFund(api, client, "m", send), { wrapper });
		act(() => result.current.mutate({ usdc: "1000000", lamports: "0", granted: "0" }));

		await waitFor(() => expect(result.current.error?.message).toBe("User rejected the request."));
		expect(actions).not.toHaveBeenCalled();
	});

	it("never asks the wallet when the transaction could not be built", async () => {
		const { api } = fakeApi(503);
		const send = vi.fn(async () => "s");
		const { result } = renderHook(() => useFund(api, client, "m", send), { wrapper });
		act(() => result.current.mutate({ usdc: "1000000", lamports: "0", granted: "0" }));

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(send).not.toHaveBeenCalled();
	});
});
