/**
 * The SOL price shown on the terminal: Jupiter's, the same one machines trade on and the watcher fires
 * levels from. The chart's candles come from elsewhere; this number is the one that decides things.
 */

export const SOL = "So11111111111111111111111111111111111111112";
const PRICE = "https://lite-api.jup.ag/price/v3";

export type Price = { usd: number; change24h: number };

/** Jupiter's answer for one token, or nothing if it did not give a usable price. */
export function readPrice(body: unknown, mint: string): Price | undefined {
	const entry = (body as Record<string, { usdPrice?: unknown; priceChange24h?: unknown }> | null)?.[
		mint
	];
	const usd = Number(entry?.usdPrice);
	const change24h = Number(entry?.priceChange24h ?? 0);
	if (!Number.isFinite(usd) || usd <= 0) return undefined;
	return { usd, change24h: Number.isFinite(change24h) ? change24h : 0 };
}

export async function fetchPrice(mint = SOL, fetcher: typeof fetch = fetch): Promise<Price> {
	const response = await fetcher(`${PRICE}?ids=${mint}`);
	if (!response.ok) throw new Error(`the price answered ${response.status}`);
	const price = readPrice(await response.json(), mint);
	if (!price) throw new Error("the price came back without a number");
	return price;
}
