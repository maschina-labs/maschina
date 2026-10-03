/**
 * The open market, as Jupiter sees it: the tokens moving most right now.
 *
 * Jupiter ranks tokens a few ways, and each catches something the others miss. Trending catches
 * attention, most traded catches money, organic score filters out wash trading and bots. A scan asks all
 * three and merges them, so one token found three ways is listed once.
 *
 * Every figure is read defensively: a field Jupiter leaves out stays unknown rather than becoming a zero
 * that looks like a fact.
 */

export const SCAN_INTERVALS = ["5m", "1h", "6h", "24h"] as const;
export type ScanInterval = (typeof SCAN_INTERVALS)[number];

const RANKINGS = ["toptrending", "toptraded", "toporganicscore"] as const;

export type MarketWindow = {
	priceChangePct: number | undefined;
	volumeUsd: number | undefined;
	buys: number | undefined;
	sells: number | undefined;
	traders: number | undefined;
};

export type MarketToken = {
	mint: string;
	symbol: string;
	name: string;
	decimals: number | undefined;
	priceUsd: number | undefined;
	liquidityUsd: number | undefined;
	marketCapUsd: number | undefined;
	holders: number | undefined;
	/** Jupiter's 0 to 100 measure of how much of the trading is real people. */
	organicScore: number | undefined;
	ageHours: number | undefined;
	verified: boolean;
	mintable: boolean | undefined;
	freezable: boolean | undefined;
	topHoldersPct: number | undefined;
	m5: MarketWindow;
	h1: MarketWindow;
	/** Which of Jupiter's rankings listed it. */
	foundBy: string[];
};

const num = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;
const record = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

function window(value: unknown): MarketWindow {
	const stats = record(value);
	const buy = num(stats["buyVolume"]);
	const sell = num(stats["sellVolume"]);
	return {
		priceChangePct: num(stats["priceChange"]),
		volumeUsd: buy === undefined && sell === undefined ? undefined : (buy ?? 0) + (sell ?? 0),
		buys: num(stats["numBuys"]),
		sells: num(stats["numSells"]),
		traders: num(stats["numTraders"]),
	};
}

/** One of Jupiter's token entries, or nothing when it has no mint to trade. */
export function parseMarketToken(entry: unknown, now: Date): MarketToken | undefined {
	const token = record(entry);
	const mint = token["id"];
	if (typeof mint !== "string" || !mint) return undefined;
	const audit = record(token["audit"]);
	const pool = record(token["firstPool"]);
	const created =
		typeof pool["createdAt"] === "string" ? Date.parse(pool["createdAt"]) : Number.NaN;
	const disabled = (field: string) =>
		typeof audit[field] === "boolean" ? !(audit[field] as boolean) : undefined;
	return {
		mint,
		symbol: typeof token["symbol"] === "string" ? token["symbol"] : "?",
		name: typeof token["name"] === "string" ? token["name"] : "",
		decimals: num(token["decimals"]),
		priceUsd: num(token["usdPrice"]),
		liquidityUsd: num(token["liquidity"]),
		marketCapUsd: num(token["mcap"]),
		holders: num(token["holderCount"]),
		organicScore: num(token["organicScore"]),
		ageHours: Number.isNaN(created) ? undefined : (now.getTime() - created) / 3_600_000,
		verified: token["isVerified"] === true,
		mintable: disabled("mintAuthorityDisabled"),
		freezable: disabled("freezeAuthorityDisabled"),
		topHoldersPct: num(audit["topHoldersPercentage"]),
		m5: window(token["stats5m"]),
		h1: window(token["stats1h"]),
		foundBy: [],
	};
}

/** Tokens that are money themselves, not bets: never worth listing as something to trade. */
const NOT_A_BET = new Set([
	"So11111111111111111111111111111111111111112",
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

export function jupiterMarket(
	options: { baseUrl?: string; apiKey?: string; fetch?: typeof globalThis.fetch } = {},
) {
	const base = (options.baseUrl ?? "https://lite-api.jup.ag").replace(/\/$/, "");
	const call = options.fetch ?? globalThis.fetch;

	return async function scan(
		request: { interval?: ScanInterval; limit?: number; now?: Date } = {},
	): Promise<MarketToken[]> {
		const interval = request.interval ?? "1h";
		const limit = Math.min(Math.max(request.limit ?? 50, 1), 100);
		const now = request.now ?? new Date();
		const found = new Map<string, MarketToken>();
		const answers = await Promise.allSettled(
			RANKINGS.map(async (ranking) => {
				const response = await call(`${base}/tokens/v2/${ranking}/${interval}?limit=${limit}`, {
					headers: options.apiKey ? { "x-api-key": options.apiKey } : {},
					signal: AbortSignal.timeout(8_000),
				});
				if (!response.ok) throw new Error(`Jupiter answered ${response.status} for ${ranking}`);
				const body = await response.json();
				return { ranking, entries: Array.isArray(body) ? body : [] };
			}),
		);
		let failures = 0;
		for (const answer of answers) {
			if (answer.status === "rejected") {
				failures += 1;
				continue;
			}
			for (const entry of answer.value.entries) {
				const token = parseMarketToken(entry, now);
				if (!token || NOT_A_BET.has(token.mint)) continue;
				const known = found.get(token.mint) ?? token;
				known.foundBy.push(answer.value.ranking.replace("top", ""));
				found.set(token.mint, known);
			}
		}
		if (failures === RANKINGS.length) throw new Error("Jupiter could not be read for the market");
		// Found by more rankings first, then by the money moving through it.
		return [...found.values()].sort(
			(a, b) =>
				b.foundBy.length - a.foundBy.length || (b.h1.volumeUsd ?? 0) - (a.h1.volumeUsd ?? 0),
		);
	};
}
