/**
 * How the gateway asks for a machine to be created.
 *
 * The gateway never touches a wallet provider. It asks the provisioner, which holds the only key that
 * can make one, and passes the answer back.
 */

import { type CreateMachineRequest, CreateMachineResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";

export function provisionerClient(options: { url: string; token: string; fetch?: typeof fetch }) {
	const fetchFn = options.fetch ?? fetch;

	return {
		async create(request: CreateMachineRequest): Promise<CreateMachineResponse> {
			let response: Response;
			try {
				response = await fetchFn(new URL("/internal/v1/machines", options.url), {
					method: "POST",
					headers: {
						authorization: `Bearer ${options.token}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(request),
					signal: AbortSignal.timeout(60_000),
				});
			} catch (cause) {
				throw new MaschinaError("unavailable", "machines cannot be created right now", { cause });
			}

			if (response.ok) return CreateMachineResponse.parse(await response.json());
			if (response.status === 400) {
				throw new MaschinaError("invalid_input", "that machine cannot be created");
			}
			if (response.status === 409) {
				throw new MaschinaError("conflict", "that machine already exists");
			}
			throw new MaschinaError("unavailable", "machines cannot be created right now");
		},
	};
}
