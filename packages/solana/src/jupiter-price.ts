/**
 * Jupiter's price API, used as the independent price.
 *
 * It is independent of the route a quote takes, which is the point: a pool that has been drained or
 * manipulated moves a quote and does not move this. It is not independent of Jupiter, so a second
 * source belongs here later, and the interface is built for more than one.
 */

import { MaschinaError } from "@maschina/core";
import type { Address } from "./address.ts";
import { parseAddress } from "./address.ts";
import { JUPITER_API, JUPITER_LITE_API } from "./jupiter.ts";
import { type PriceSource, type UsdPrice, usdMicrosFrom } from "./price.ts";

export type JupiterPriceOptions = {
	baseUrl?: string;
	apiKey?: string;
	timeoutMs?: number;
	fetch?: typeof globalThis.fetch;
	now?: () => Date;
};

const DEFAULT_TIMEOUT_MS = 5000;
/** Asking about more than this in one request is refused by the API. */
const MAX_MINTS = 50;

export function jupiterPrices(options: JupiterPriceOptions = {}): PriceSource {
	const baseUrl = (options.baseUrl ?? (options.apiKey ? JUPITER_API : JUPITER_LITE_API)).replace(
		/\/$/,
		"",
	);
	const call = options.fetch ?? globalThis.fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const now = options.now ?? (() => new Date());

	return {
		name: "jupiter price",

		async usdPrices(mints: Address[], signal?: AbortSignal): Promise<Map<Address, UsdPrice>> {
			if (mints.length === 0) return new Map();
			if (mints.length > MAX_MINTS) {
				throw new MaschinaError("invalid_input", `ask about at most ${MAX_MINTS} tokens at once`);
			}

			const url = new URL(`${baseUrl}/price/v3`);
			url.searchParams.set("ids", mints.join(","));

			const timeout = AbortSignal.timeout(timeoutMs);
			const response = await call(url, {
				headers: options.apiKey ? { "x-api-key": options.apiKey } : {},
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
			});

			if (response.status === 429) {
				throw new MaschinaError("limit_exceeded", "rate limit from the price API");
			}
			if (!response.ok) {
				throw new MaschinaError("unavailable", `the price API answered ${response.status}`);
			}

			return parseJupiterPrices(await response.json(), now());
		},
	};
}

/** Reads the price API's answer, keeping only prices that are actually usable. */
export function parseJupiterPrices(body: unknown, at: Date): Map<Address, UsdPrice> {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new MaschinaError("invalid_input", "the price API's answer is not a set of prices");
	}

	const prices = new Map<Address, UsdPrice>();
	for (const [mint, value] of Object.entries(body as Record<string, unknown>)) {
		if (typeof value !== "object" || value === null) continue;
		const usdPrice = (value as { usdPrice?: unknown }).usdPrice;
		if (typeof usdPrice !== "number") {
			throw new MaschinaError("invalid_input", "a price is not a number", { details: { mint } });
		}
		if (usdPrice <= 0) {
			// A token priced at nothing is not a price, and dividing by it later would be worse.
			throw new MaschinaError("invalid_input", "a price is zero or negative", {
				details: { mint },
			});
		}
		const address = parseAddress(mint);
		prices.set(address, {
			mint: address,
			micros: usdMicrosFrom(usdPrice),
			source: "jupiter price",
			at,
		});
	}
	return prices;
}

/** The price for one mint, or a clear failure. Used where a missing price must stop a trade. */
export function requirePrice(
	prices: Map<Address, UsdPrice>,
	mint: Address,
	sourceName = "the price source",
): UsdPrice {
	const price = prices.get(mint);
	if (!price) {
		throw new MaschinaError("not_found", `${sourceName} has no price for this token`, {
			details: { mint },
		});
	}
	return price;
}
