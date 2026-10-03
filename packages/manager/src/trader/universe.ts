/**
 * The trader's universe: every token moving on Solana right now, swept and ranked.
 *
 * One sweep asks every ranking Jupiter has over every window, a hundred deep each, and merges them by
 * mint, which is a few hundred tokens. That whole list is too much to hand a model on every look, and
 * paying to read it each time would eat the owner's credit, so the engine ranks it and the AI sees the
 * top of it, with the rest a tool call away.
 *
 * The ranking is plain and on purpose: money moving through a token now, against how deep its pool is,
 * and which way the price is going. It decides what the AI looks at first, never what it may buy.
 */

export type UniverseToken = {
	mint: string;
	symbol: string;
	decimals: number | null;
	priceUsd: number | null;
	liquidityUsd: number | null;
	marketCapUsd: number | null;
	holders: number | null;
	ageHours: number | null;
	organic: number | null;
	canMintMore: boolean | null;
	canFreeze: boolean | null;
	topHoldersPct: number | null;
	change5mPct: number | null;
	change1hPct: number | null;
	volume5mUsd: number | null;
	volume1hUsd: number | null;
	buysSells5m: string | null;
};

export const WINDOWS = ["5m", "1h", "6h", "24h"] as const;

export async function sweep(
	scan: (request: { interval: (typeof WINDOWS)[number]; limit: number }) => Promise<unknown[]>,
): Promise<UniverseToken[]> {
	const found = new Map<string, UniverseToken>();
	const answers = await Promise.allSettled(
		WINDOWS.map((interval) => scan({ interval, limit: 100 })),
	);
	for (const answer of answers) {
		if (answer.status !== "fulfilled") continue;
		for (const each of answer.value) {
			const token = each as UniverseToken;
			// The shortest window's figures are the freshest, so the first sighting is kept.
			if (typeof token.mint === "string" && !found.has(token.mint)) found.set(token.mint, token);
		}
	}
	if (found.size === 0 && answers.every((answer) => answer.status === "rejected"))
		throw new Error("the market could not be read");
	return [...found.values()];
}

/**
 * How lively a token is for a quick trade. Money through it in the last five minutes as a share of its
 * pool, so a busy small pool and a busy large one compare fairly, lifted when the price is rising and cut
 * when it is falling. A pool too thin to get out of scores nothing.
 */
export function liveliness(token: UniverseToken): number {
	const liquidity = token.liquidityUsd ?? 0;
	if (liquidity < 10_000) return 0;
	const turnover = (token.volume5mUsd ?? 0) / liquidity;
	const trend = (token.change5mPct ?? 0) * 0.6 + (token.change1hPct ?? 0) * 0.1;
	const direction = Math.max(0.2, 1 + trend / 20);
	return turnover * direction;
}

export function shortlist(tokens: UniverseToken[], count: number): UniverseToken[] {
	return [...tokens]
		.map((token) => ({ token, score: liveliness(token) }))
		.filter((each) => each.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, count)
		.map((each) => each.token);
}
