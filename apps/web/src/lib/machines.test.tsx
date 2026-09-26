import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "./api.ts";
import {
	amount,
	useCreateMachine,
	useMachine,
	useMachineAction,
	useMachines,
	useRecord,
} from "./machines.ts";
import { createQueryClient } from "./query.ts";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const machine = {
	machineId: "01a0dc24-9e5d-7061-9a53-b8b38753d78a",
	name: "SOL dip buyer",
	kind: "price_trigger",
	state: "running",
	walletAddress: "7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe",
	createdAt: "2026-09-21T09:00:00.000Z",
	budget: { granted: "50000000", reserved: "0", settled: "5000000", available: "45000000" },
};

/** Only the calls these hooks make, shaped the way the typed client shapes them. */
function fakeApi(answers: Record<string, () => Response>) {
	const called: string[] = [];
	const answer = (key: string) => {
		called.push(key);
		const found = answers[key];
		if (!found) throw new Error(`nothing stubbed for ${key}`);
		return Promise.resolve(found());
	};
	const api = {
		v1: {
			machines: Object.assign(
				{
					$get: () => answer("list"),
					$post: () => answer("create"),
				},
				{
					":machineId": {
						$get: () => answer("read"),
						record: { $get: () => answer("record") },
						actions: { $post: () => answer("action") },
					},
				},
			),
		},
	} as unknown as Api;
	return { api, called };
}

function wrap() {
	const queryClient = createQueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	return { queryClient, wrapper };
}

describe("reading machines", () => {
	it("unwraps the list the API returns", async () => {
		const { api } = fakeApi({ list: () => json({ machines: [machine] }) });
		const { wrapper } = wrap();

		const { result } = renderHook(() => useMachines(api), { wrapper });

		await waitFor(() => expect(result.current.data).toEqual([machine]));
	});

	it("reads one machine, and its record", async () => {
		const { api } = fakeApi({
			read: () => json({ ...machine, settings: {}, limits: { approvedMints: [] }, actions: [] }),
			record: () =>
				json({ events: [{ id: "1", type: "run.started", occurredAt: "x", payload: {} }] }),
		});
		const { wrapper } = wrap();

		const one = renderHook(() => useMachine(api, machine.machineId), { wrapper });
		const record = renderHook(() => useRecord(api, machine.machineId), { wrapper });

		await waitFor(() => expect(one.result.current.data?.name).toBe("SOL dip buyer"));
		await waitFor(() => expect(record.result.current.data).toHaveLength(1));
	});

	it("shows the reason the API gave, not the status code", async () => {
		const { api } = fakeApi({
			list: () => json({ error: { message: "sign in first" } }, 401),
		});
		const { wrapper } = wrap();

		const { result } = renderHook(() => useMachines(api), { wrapper });

		await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
		expect(result.current.error?.message).toBe("sign in first");
	});

	it("falls back to the status when the API says nothing useful", async () => {
		const { api } = fakeApi({ list: () => new Response("", { status: 503 }) });
		const { wrapper } = wrap();

		const { result } = renderHook(() => useMachines(api), { wrapper });

		await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 10_000 });
		expect(result.current.error?.message).toMatch(/503/);
	});
});

describe("changing a machine", () => {
	it("acts on a machine and forgets what it knew about machines afterwards", async () => {
		const { api, called } = fakeApi({ action: () => json({ state: "running" }) });
		const { queryClient, wrapper } = wrap();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useMachineAction(api, queryClient, machine.machineId), {
			wrapper,
		});
		await result.current.mutateAsync({ action: "start" });

		expect(called).toEqual(["action"]);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["machines"] });
	});

	it("creates a machine and forgets the list", async () => {
		const { api } = fakeApi({
			create: () => json({ machineId: machine.machineId, walletAddress: machine.walletAddress }),
		});
		const { queryClient, wrapper } = wrap();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useCreateMachine(api, queryClient), { wrapper });
		const made = await result.current.mutateAsync({
			name: "SOL dip buyer",
			kind: "price_trigger",
			settings: { level: "142000000" },
			limits: { budgetGranted: "50000000", approvedMints: [machine.walletAddress] },
		});

		expect(made.machineId).toBe(machine.machineId);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["machines"] });
	});
});

describe("showing an amount", () => {
	it("reads base units as money, at the currency's own decimals", () => {
		expect(amount("50000000")).toBe("50.00");
		expect(amount("1234567890", 9)).toBe("1.23");
		expect(amount("0")).toBe("0.00");
		expect(amount("1000000000000")).toBe("1,000,000.00");
	});
});
