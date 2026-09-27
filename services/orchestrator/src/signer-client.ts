/**
 * How the orchestrator asks the signer. It is the only thing that may.
 *
 * A trade can take a minute or more to settle, because the signer waits for the chain's answer before it
 * replies. The timeout allows for that. Everything that comes back is checked against the contract.
 */

import {
	type SignRequest,
	SignResponse,
	type SweepRequest,
	SweepResponse,
	type WithdrawEverythingRequest,
	WithdrawEverythingResponse,
	type WithdrawRequest,
	WithdrawResponse,
} from "@maschina/contracts";
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

		/** Asks the signer to return a machine's funds. Where they go is the signer's to work out. */
		async withdraw(request: WithdrawRequest): Promise<WithdrawResponse> {
			let response: Response;
			try {
				response = await fetchFn(new URL("/internal/v1/withdraw", options.url), {
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

			if (response.ok) return WithdrawResponse.parse(await response.json());
			if (response.status === 503) {
				throw new MaschinaError("unavailable", "the signer cannot send right now");
			}
			if (response.status === 400) {
				throw new MaschinaError("invalid_input", "the signer could not read the withdrawal");
			}
			throw new MaschinaError("internal", `the signer answered ${response.status}`);
		},

		/**
		 * Asks the signer whether a machine has profit to bank, and to bank it if so. What is due and where
		 * it goes are the signer's to work out; the request names the machine and nothing else.
		 */
		async sweep(request: SweepRequest): Promise<SweepResponse> {
			let response: Response;
			try {
				response = await fetchFn(new URL("/internal/v1/sweep", options.url), {
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

			if (response.ok) return SweepResponse.parse(await response.json());
			if (response.status === 503) {
				throw new MaschinaError("unavailable", "the signer cannot sweep right now");
			}
			if (response.status === 400) {
				throw new MaschinaError("invalid_input", "the signer could not read the sweep");
			}
			throw new MaschinaError("internal", `the signer answered ${response.status}`);
		},

		/** Asks the signer for everything a machine holds to go home. What and where are its to work out. */
		async withdrawEverything(
			request: WithdrawEverythingRequest,
		): Promise<WithdrawEverythingResponse> {
			let response: Response;
			try {
				response = await fetchFn(new URL("/internal/v1/withdraw-everything", options.url), {
					method: "POST",
					headers: {
						authorization: `Bearer ${options.token}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(request),
					// Up to three transactions, each waiting for the chain, so three times a trade's wait.
					signal: AbortSignal.timeout(TIMEOUT_MS * 3),
				});
			} catch (cause) {
				throw new MaschinaError("unavailable", "the signer could not be reached", { cause });
			}

			if (response.ok) return WithdrawEverythingResponse.parse(await response.json());
			if (response.status === 503) {
				throw new MaschinaError("unavailable", "the signer cannot send right now");
			}
			if (response.status === 400) {
				throw new MaschinaError("invalid_input", "the signer could not read the withdrawal");
			}
			throw new MaschinaError("internal", `the signer answered ${response.status}`);
		},
	};
}
