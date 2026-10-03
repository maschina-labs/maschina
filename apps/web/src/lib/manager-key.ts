/**
 * The owner's AI key, from the browser's side.
 *
 * The key is sent once, when it is set, and never comes back: the API answers only whether one is in and
 * its last four characters. Nothing here keeps it, so closing the page leaves no copy in the browser.
 */

import { type QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { Api } from "./api.ts";
import { ApiError } from "./machines.ts";

export type KeyStatus = { set: boolean; hint?: string; setAt?: string };

async function read<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	const body = (await response.json().catch(() => undefined)) as
		| { error?: { message?: string } }
		| undefined;
	throw new ApiError(
		body?.error?.message ?? `The API answered ${response.status}.`,
		response.status,
	);
}

const KEY = ["manager-key"];

export function useManagerKey(api: Api, enabled: boolean) {
	return useQuery({
		queryKey: KEY,
		queryFn: async () => read<KeyStatus>(await api.v1.manager.key.$get()),
		enabled,
		retry: false,
	});
}

export function useSetManagerKey(api: Api, queryClient: QueryClient) {
	return useMutation({
		mutationFn: async (key: string) =>
			read<KeyStatus>(await api.v1.manager.key.$put({ json: { key } })),
		onSuccess: (status) => queryClient.setQueryData(KEY, status),
	});
}

export function useClearManagerKey(api: Api, queryClient: QueryClient) {
	return useMutation({
		mutationFn: async () => read<KeyStatus>(await api.v1.manager.key.$delete()),
		onSuccess: (status) => queryClient.setQueryData(KEY, status),
	});
}
