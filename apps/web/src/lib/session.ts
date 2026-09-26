/**
 * Signing in, from the browser's side.
 *
 * Three steps and no secrets: ask the API for a sentence, have the wallet sign it, hand it back. The
 * session arrives as a cookie the browser keeps and script cannot read, so there is nothing here to
 * store and nothing to leak.
 */

import { type QueryClient, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import type { Api } from "./api.ts";
import { connect, signMessage } from "./wallet.ts";

export type SignedInOwner = { ownerId: string; walletAddress: string };

/** The API says why in its body, and that reason is the one worth showing a person. */
async function read<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	const body = (await response.json().catch(() => undefined)) as
		| { error?: { message?: string } }
		| undefined;
	throw new Error(body?.error?.message ?? `The API answered ${response.status}.`);
}

/** Who is signed in, according to the API rather than to anything this app remembers. */
export const sessionQuery = (api: Api) =>
	queryOptions({
		queryKey: ["session"],
		queryFn: async (): Promise<SignedInOwner | null> => {
			const response = await api.v1.auth.me.$get();
			// Not signed in is an ordinary answer here, not a failure worth showing anybody.
			if (!response.ok) return null;
			return read<SignedInOwner>(response);
		},
		staleTime: 30_000,
		retry: false,
	});

export function useSession(api: Api) {
	return useQuery(sessionQuery(api));
}

export function useSignIn(api: Api, queryClient: QueryClient) {
	return useMutation({
		mutationFn: async (): Promise<SignedInOwner> => {
			const walletAddress = await connect();
			const challenge = await read<{ message: string }>(
				await api.v1.auth.challenge.$post({ json: { walletAddress } }),
			);
			const signature = await signMessage(challenge.message);
			return read<SignedInOwner>(
				await api.v1.auth.verify.$post({
					json: { walletAddress, message: challenge.message, signature },
				}),
			);
		},
		onSuccess: (owner) => {
			queryClient.setQueryData(sessionQuery(api).queryKey, owner);
		},
	});
}

export function useSignOut(api: Api, queryClient: QueryClient) {
	return useMutation({
		mutationFn: async () => {
			await api.v1.auth["sign-out"].$post();
		},
		onSuccess: () => {
			queryClient.setQueryData(sessionQuery(api).queryKey, null);
		},
	});
}
