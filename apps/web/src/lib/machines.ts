/**
 * The machines API, as the app sees it.
 *
 * Every read is a query so the app can show what it already knows while it checks again. Every write
 * invalidates what it changed rather than guessing the new state, because the record decides what a
 * machine is, not this code.
 */

import { type QueryClient, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import type { Api } from "./api.ts";

export type MachineAction = "fund" | "start" | "pause" | "resume" | "stop";

type Budget = {
	granted: string;
	reserved: string;
	settled: string;
	available: string;
};

export type MachineSummary = {
	machineId: string;
	name: string;
	kind: string;
	state: "draft" | "ready" | "running" | "paused" | "stopped";
	stateReason?: string;
	walletAddress: string;
	createdAt: string;
	budget: Budget;
};

export type MachineDetail = MachineSummary & {
	settings: Record<string, unknown>;
	limits: { maxPerTrade?: string; maxPerDay?: string; approvedMints: string[] };
	actions: MachineAction[];
};

export type RecordEntry = {
	id: string;
	type: string;
	occurredAt: string;
	payload: Record<string, unknown>;
};

async function read<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	const body = (await response.json().catch(() => undefined)) as
		| { error?: { message?: string } }
		| undefined;
	throw new Error(body?.error?.message ?? `The API answered ${response.status}.`);
}

const machinesQuery = (api: Api) =>
	queryOptions({
		queryKey: ["machines"],
		// The API wraps its lists, so the shape stays open to adding a cursor later.
		queryFn: async () =>
			(await read<{ machines: MachineSummary[] }>(await api.v1.machines.$get())).machines,
	});

const machineQuery = (api: Api, machineId: string) =>
	queryOptions({
		queryKey: ["machines", machineId],
		queryFn: async () =>
			read<MachineDetail>(await api.v1.machines[":machineId"].$get({ param: { machineId } })),
	});

const recordQuery = (api: Api, machineId: string) =>
	queryOptions({
		queryKey: ["machines", machineId, "record"],
		queryFn: async () =>
			(
				await read<{ events: RecordEntry[] }>(
					await api.v1.machines[":machineId"].record.$get({
						param: { machineId },
						query: { limit: "100" },
					}),
				)
			).events,
	});

export const useMachines = (api: Api) => useQuery(machinesQuery(api));
export const useMachine = (api: Api, machineId: string) => useQuery(machineQuery(api, machineId));
export const useRecord = (api: Api, machineId: string) => useQuery(recordQuery(api, machineId));

/** Fund, start, pause, resume or stop. Funding carries the new total the machine may spend. */
export function useMachineAction(api: Api, queryClient: QueryClient, machineId: string) {
	return useMutation({
		mutationFn: async (request: { action: MachineAction; budgetGranted?: string }) =>
			read<{ state: string }>(
				await api.v1.machines[":machineId"].actions.$post({
					param: { machineId },
					json: request,
				}),
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["machines"] });
		},
	});
}

export type NewMachine = {
	name: string;
	kind: string;
	settings: Record<string, unknown>;
	limits: {
		budgetGranted: string;
		maxPerTrade?: string;
		maxPerDay?: string;
		approvedMints: string[];
	};
};

export function useCreateMachine(api: Api, queryClient: QueryClient) {
	return useMutation({
		mutationFn: async (machine: NewMachine) =>
			read<{ machineId: string; walletAddress: string }>(
				await api.v1.machines.$post({ json: machine }),
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["machines"] });
		},
	});
}

/** Base units to something a person reads. USDC has six decimals, SOL has nine. */
export function amount(base: string, decimals = 6): string {
	const whole = BigInt(base) / 10n ** BigInt(decimals);
	const fraction = BigInt(base) % 10n ** BigInt(decimals);
	const shown = fraction.toString().padStart(decimals, "0").slice(0, 2);
	return `${whole.toLocaleString("en-US")}.${shown}`;
}
