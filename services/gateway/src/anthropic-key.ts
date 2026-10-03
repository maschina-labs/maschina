/**
 * Asking Anthropic whether a key works, before it is kept.
 *
 * Listing models is the cheapest call there is: it proves the key is real and active without spending
 * any of the owner's credit.
 */

import { MaschinaError } from "@maschina/core";

const ANTHROPIC_API = "https://api.anthropic.com";

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
	// Anthropic says why in its body, and its reason is the one worth showing: a key with no credit, a
	// disabled organization or the wrong kind of key all look alike otherwise.
	const body = (await response.json().catch(() => undefined)) as
		| { error?: { message?: unknown } }
		| undefined;
	const why = typeof body?.error?.message === "string" ? `: ${body.error.message}` : "";
	if (response.status === 401 || response.status === 403)
		throw new MaschinaError("invalid_input", `Anthropic did not accept that key${why}`);
	if (response.status === 400)
		throw new MaschinaError("invalid_input", `Anthropic refused that key${why}`);
	throw new MaschinaError(
		"unavailable",
		`Anthropic answered ${response.status} while checking the key${why}`,
	);
}
