import type { BaseUnits } from "@maschina/core";
import type { Address } from "@solana/kit";
import type { MintDetails } from "./mint.ts";
import type { QuoteRequest, SwapQuote } from "./router.ts";

/**
 * The facts the token screen judges a token on, read from the places that know them.
 *
 * Who can mint and who can freeze come from the chain itself, because those two decide whether a holder
 * can be robbed and nobody else's word should settle that. Holders, liquidity, how concentrated it is
 * and how old it is come from Jupiter's token list. Whether it can be sold, and what trading it costs,
 * come from real quotes both ways at the size a machine would trade.
 *
 * Each fact is read on its own. One that cannot be read is left unknown, so the screen refuses it rather
 * than a missing number being mistaken for a good one.
 */

export type TokenReading = {
	mint: string;
	mintAuthority: string | null | undefined;
	freezeAuthority: string | null | undefined;
	topHoldersShare: number | undefined;
	holders: number | undefined;
	liquidityUsd: number | undefined;
	ageHours: number | undefined;
	buyImpactPct: number | undefined;
	sellImpactPct: number | undefined;
	sellRoute: boolean | undefined;
};

/** What Jupiter's token list says about one token. */
export type TokenInfo = {
	holders: number | undefined;
	liquidityUsd: number | undefined;
	topHoldersShare: number | undefined;
	firstPoolAt: Date | undefined;
};

const num = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Jupiter's answer to a search by mint, for the one token asked about, or nothing if it is not there. */
export function parseTokenInfo(body: unknown, mint: string): TokenInfo | undefined {
	if (!Array.isArray(body)) return undefined;
	const found = body.find(
		(entry): entry is Record<string, unknown> =>
			typeof entry === "object" && entry !== null && (entry as { id?: unknown }).id === mint,
	);
	if (!found) return undefined;
	const audit = (found["audit"] ?? {}) as Record<string, unknown>;
	const pool = (found["firstPool"] ?? {}) as Record<string, unknown>;
	const share = num(audit["topHoldersPercentage"]);
	const created = typeof pool["createdAt"] === "string" ? new Date(pool["createdAt"]) : undefined;
	return {
		holders: num(found["holderCount"]),
		liquidityUsd: num(found["liquidity"]),
		topHoldersShare: share === undefined ? undefined : share / 100,
		firstPoolAt: created && !Number.isNaN(created.getTime()) ? created : undefined,
	};
}

/** Jupiter's token list, searched by mint. */
export function jupiterTokenInfo(
	options: { baseUrl?: string; apiKey?: string; fetch?: typeof globalThis.fetch } = {},
) {
	const base = (options.baseUrl ?? "https://lite-api.jup.ag").replace(/\/$/, "");
	const call = options.fetch ?? globalThis.fetch;
	return async (mint: string): Promise<TokenInfo | undefined> => {
		const url = new URL(`${base}/tokens/v2/search`);
		url.searchParams.set("query", mint);
		const response = await call(url, {
			headers: options.apiKey ? { "x-api-key": options.apiKey } : {},
			signal: AbortSignal.timeout(8_000),
		});
		if (!response.ok) throw new Error(`Jupiter's token list answered ${response.status}`);
		return parseTokenInfo(await response.json(), mint);
	};
}

const settled = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
	try {
		return await work();
	} catch {
		return undefined;
	}
};

export async function readTokenFacts(input: {
	mint: Address;
	usdc: Address;
	/** The size a machine would trade, in USDC base units: impact is measured at this size. */
	sizeUsdc: BaseUnits;
	now: Date;
	mints: (mint: Address) => Promise<MintDetails>;
	info: (mint: string) => Promise<TokenInfo | undefined>;
	router: { quote: (request: QuoteRequest) => Promise<SwapQuote> };
}): Promise<TokenReading> {
	const [details, info, buy] = await Promise.all([
		settled(() => input.mints(input.mint)),
		settled(() => input.info(input.mint)),
		settled(() =>
			input.router.quote({
				inputMint: input.usdc,
				outputMint: input.mint,
				amount: input.sizeUsdc,
				slippageBps: 100,
			}),
		),
	]);
	// Selling back what that buy would get: whether there is a way out, and what it costs.
	const sell = buy
		? await settled(() =>
				input.router.quote({
					inputMint: input.mint,
					outputMint: input.usdc,
					amount: buy.outputAmount,
					slippageBps: 100,
				}),
			)
		: undefined;

	return {
		mint: input.mint,
		mintAuthority: details ? (details.mintAuthority ?? null) : undefined,
		freezeAuthority: details ? (details.freezeAuthority ?? null) : undefined,
		topHoldersShare: info?.topHoldersShare,
		holders: info?.holders,
		liquidityUsd: info?.liquidityUsd,
		ageHours: info?.firstPoolAt
			? (input.now.getTime() - info.firstPoolAt.getTime()) / 3_600_000
			: undefined,
		buyImpactPct: buy ? buy.priceImpactBps / 100 : undefined,
		sellImpactPct: sell ? sell.priceImpactBps / 100 : undefined,
		// No buy quote means the question was never asked; a buy with no sell back means there is no way out.
		sellRoute: buy ? sell !== undefined : undefined,
	};
}
