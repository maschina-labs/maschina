/**
 * Prices from DexScreener: dollars per whole token, for many tokens in one call.
 *
 * A second source beside Jupiter's, with a far larger free allowance (300 calls a minute against
 * Jupiter's shared free tier), which matters for a trader that prices what it holds every few seconds.
 * A token trades in several pools; the deepest one's price is the one a sale would actually get near.
 */

const BATCH = 30;

type Pair = {
	chainId?: unknown;
	priceUsd?: unknown;
	liquidity?: { usd?: unknown };
	baseToken?: { address?: unknown };
};

/** The deepest Solana pool's price for each token in DexScreener's answer. */
export function parseDexPrices(body: unknown): Map<string, number> {
	const best = new Map<string, { price: number; depth: number }>();
	if (!Array.isArray(body)) return new Map();
	for (const pair of body as Pair[]) {
		if (pair?.chainId !== "solana") continue;
		const mint = pair.baseToken?.address;
		const price = Number(pair.priceUsd);
		const depth = Number(pair.liquidity?.usd ?? 0);
		if (typeof mint !== "string" || !Number.isFinite(price) || price <= 0) continue;
		const known = best.get(mint);
		if (!known || depth > known.depth)
			best.set(mint, { price, depth: Number.isFinite(depth) ? depth : 0 });
	}
	return new Map([...best].map(([mint, each]) => [mint, each.price]));
}

export function dexScreenerPrices(
	options: { baseUrl?: string; fetch?: typeof globalThis.fetch } = {},
) {
	const base = (options.baseUrl ?? "https://api.dexscreener.com").replace(/\/$/, "");
	const call = options.fetch ?? globalThis.fetch;
	return async (mints: string[]): Promise<Map<string, number>> => {
		const found = new Map<string, number>();
		for (let start = 0; start < mints.length; start += BATCH) {
			const batch = mints.slice(start, start + BATCH);
			const response = await call(`${base}/tokens/v1/solana/${batch.join(",")}`, {
				signal: AbortSignal.timeout(8_000),
			});
			if (!response.ok) throw new Error(`DexScreener answered ${response.status}`);
			for (const [mint, price] of parseDexPrices(await response.json())) found.set(mint, price);
		}
		return found;
	};
}
