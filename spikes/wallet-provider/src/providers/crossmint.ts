import type { CrossmintEnv } from "../env.ts";
import { describeError, type PingResult, type SpikeProvider } from "./provider.ts";

const API_VERSION = "2025-06-09";

// Crossmint has no "who am I" endpoint. Asking for a wallet that can't exist shows whether the key gets
// past authentication: a refused key is rejected first, an accepted one gets "not found".
const PROBE_LOCATOR = "11111111111111111111111111111111";

export function crossmint(env: CrossmintEnv, fetchFn: typeof fetch = fetch): SpikeProvider {
	const environment = env.apiBaseUrl.includes("staging") ? "staging" : "production";
	return {
		name: "crossmint",
		async ping(): Promise<PingResult> {
			let status: number;
			try {
				const response = await fetchFn(
					`${env.apiBaseUrl}/api/${API_VERSION}/wallets/${PROBE_LOCATOR}`,
					{
						headers: { "X-API-KEY": env.apiKey },
						signal: AbortSignal.timeout(10_000),
					},
				);
				status = response.status;
			} catch (error) {
				return { ok: false, detail: `request failed: ${describeError(error)}` };
			}
			if (status === 401 || status === 403) return { ok: false, detail: `key refused (${status})` };
			if (status === 400 || status === 404)
				return { ok: true, detail: `key accepted (${environment})` };
			return { ok: false, detail: `unexpected response ${status}` };
		},
	};
}
