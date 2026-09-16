export type PingResult = { ok: boolean; detail: string };

/**
 * One wallet provider under test. The spike grows this as each A0 check is built; for now a provider
 * only proves its credentials work.
 */
export interface SpikeProvider {
	readonly name: "turnkey" | "crossmint";
	ping(): Promise<PingResult>;
}

/** An error's message, for reports. Callers must make sure it can't contain a secret. */
export function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
