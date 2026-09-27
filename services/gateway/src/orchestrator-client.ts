/**
 * How the gateway asks the orchestrator for something on an owner's behalf.
 *
 * Only one thing today: taking everything out of a machine. The gateway has already decided who the
 * owner is and that the machine is theirs; the orchestrator decides whether the machine is settled
 * enough to empty, and the signer decides everything about the money.
 */

import { type WithdrawEverythingRequest, WithdrawEverythingResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";

/** Up to three transactions, each waiting on the chain. Longer than the orchestrator waits for them. */
const TIMEOUT_MS = 480_000;

/** The orchestrator's own words, when it gave any, so an owner is told what to do rather than "no". */
async function reasonFrom(response: Response, fallback: string): Promise<string> {
	try {
		const body = (await response.json()) as { error?: { message?: unknown } };
		const message = body.error?.message;
		return typeof message === "string" && message.length > 0 ? message : fallback;
	} catch {
		return fallback;
	}
}

export function orchestratorClient(options: { url: string; token: string; fetch?: typeof fetch }) {
	const fetchFn = options.fetch ?? fetch;

	return {
		async withdrawEverything(
			request: WithdrawEverythingRequest,
		): Promise<WithdrawEverythingResponse> {
			let response: Response;
			try {
				response = await fetchFn(new URL("/owner/v1/withdraw-everything", options.url), {
					method: "POST",
					headers: {
						authorization: `Bearer ${options.token}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(request),
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
			} catch (cause) {
				throw new MaschinaError("unavailable", "withdrawals cannot be made right now", { cause });
			}

			if (response.ok) return WithdrawEverythingResponse.parse(await response.json());
			if (response.status === 409) {
				throw new MaschinaError("conflict", await reasonFrom(response, "pause or stop it first"));
			}
			if (response.status === 404) {
				throw new MaschinaError("not_found", "no such machine");
			}
			if (response.status === 400) {
				throw new MaschinaError("invalid_input", "that withdrawal cannot be made");
			}
			throw new MaschinaError("unavailable", "withdrawals cannot be made right now");
		},
	};
}
