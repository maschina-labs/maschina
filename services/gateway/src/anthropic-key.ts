/**
 * Asking Anthropic whether a key works, before it is kept.
 *
 * Listing models is the cheapest call there is: it proves the key is real and active without spending
 * any of the owner's credit.
 */

import { MaschinaError } from "@maschina/core";

export const ANTHROPIC_API = "https://api.anthropic.com";

export async function checkAnthropicKey(
	key: string,
	options: { baseUrl?: string; fetch?: typeof globalThis.fetch } = {},
): Promise<void> {
	const call = options.fetch ?? globalThis.fetch;
	let response: Response;
	try {
		response = await call(`${options.baseUrl ?? ANTHROPIC_API}/v1/models?limit=1`, {
			headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
			signal: AbortSignal.timeout(10_000),
		});
	} catch {
		throw new MaschinaError("unavailable", "Anthropic could not be reached to check the key");
	}
	if (response.ok) return;
	if (response.status === 401 || response.status === 403)
		throw new MaschinaError("invalid_input", "Anthropic did not accept that key");
	throw new MaschinaError(
		"unavailable",
		`Anthropic answered ${response.status} while checking the key`,
	);
}
