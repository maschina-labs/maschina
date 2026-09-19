/**
 * How the orchestrator asks the signer. It is the only thing that may.
 *
 * A trade can take a minute or more to settle, because the signer waits for the chain's answer before it
 * replies. The timeout allows for that. Everything that comes back is checked against the contract.
 */

import { type SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";

/** Longer than the signer waits for the chain, so the signer always answers first. */
const TIMEOUT_MS = 150_000;

export function signerClient(options: { url: string; token: string; fetch?: typeof fetch }) {
	const fetchFn = options.fetch ?? fetch;

	return {
		async sign(request: SignRequest): Promise<SignResponse> {
			let response: Response;
			try {
				response = await fetchFn(new URL("/internal/v1/sign", options.url), {
					method: "POST",
					headers: {
						authorization: `Bearer ${options.token}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(request),
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
			} catch (cause) {
				throw new MaschinaError("unavailable", "the signer could not be reached", { cause });
			}

			if (response.ok) return SignResponse.parse(await response.json());
			if (response.status === 503) {
				throw new MaschinaError("unavailable", "the signer cannot sign right now");
			}
			if (response.status === 400) {
				throw new MaschinaError("invalid_input", "the signer could not read the proposal");
			}
			throw new MaschinaError("internal", `the signer answered ${response.status}`);
		},
	};
}
