/**
 * A live swap quote from Jupiter, the same router machines trade through. Quotes are free and need no
 * wallet; doing the swap, signed from the owner's wallet with Maschina's fee on it, comes later.
 */

export const TOKENS = {
	USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
	SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
} as const;
export type Token = keyof typeof TOKENS;

export type Quote = {
	/** What arrives, in whole tokens. */
	out: number;
	/** The least that can arrive at the slippage allowed. */
	atLeast: number;
	/** How much this trade moves the price, as a percentage. */
	impactPct: number;
	/** The venues it goes through, in order. */
	route: string[];
};

const QUOTE = "https://lite-api.jup.ag/swap/v1/quote";

/** Jupiter's answer read into whole tokens, or nothing if it did not quote. */
export function readQuote(body: unknown, to: Token): Quote | undefined {
	const q = body as {
		outAmount?: string;
		otherAmountThreshold?: string;
		priceImpactPct?: string;
		routePlan?: { swapInfo?: { label?: string } }[];
	} | null;
	const unit = 10 ** TOKENS[to].decimals;
	const out = Number(q?.outAmount) / unit;
	const atLeast = Number(q?.otherAmountThreshold) / unit;
	if (!Number.isFinite(out) || out <= 0 || !Number.isFinite(atLeast)) return undefined;
	return {
		out,
		atLeast,
		impactPct: Number(q?.priceImpactPct ?? 0) * 100,
		route: (q?.routePlan ?? []).map((step) => step.swapInfo?.label ?? "?"),
	};
}

export async function fetchQuote(
	from: Token,
	to: Token,
	amount: number,
	slippageBps = 50,
	fetcher: typeof fetch = fetch,
): Promise<Quote> {
	const base = Math.round(amount * 10 ** TOKENS[from].decimals);
	const url = `${QUOTE}?inputMint=${TOKENS[from].mint}&outputMint=${TOKENS[to].mint}&amount=${base}&slippageBps=${slippageBps}`;
	const response = await fetcher(url);
	if (!response.ok) throw new Error(`Jupiter answered ${response.status}`);
	const quote = readQuote(await response.json(), to);
	if (!quote) throw new Error("Jupiter found no route");
	return quote;
}
