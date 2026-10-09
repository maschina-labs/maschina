import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 15_000,
				retry: (failures, error) => failures < 2 && !isClientError(error),
				refetchOnWindowFocus: true,
			},
		},
	});
}

/** A 4xx won't fix itself on retry. */
export function isClientError(error: unknown): boolean {
	const status = (error as { status?: unknown } | null)?.status;
	return typeof status === "number" && status >= 400 && status < 500;
}
