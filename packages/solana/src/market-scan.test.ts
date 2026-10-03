import { describe, expect, it, vi } from "vitest";
import { jupiterMarket, parseMarketToken } from "./market-scan.ts";

const NOW = new Date("2026-10-03T12:00:00Z");

const pump = {
	id: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
	symbol: "PUMP",
	name: "Pump",
	decimals: 6,
	usdPrice: 0.0054,
	liquidity: 40_327_119,
	mcap: 2_538_573_333,
	holderCount: 292_292,
	organicScore: 98.5,
	isVerified: true,
	firstPool: { createdAt: "2026-10-02T12:00:00Z" },
	audit: {
		mintAuthorityDisabled: true,
		freezeAuthorityDisabled: false,
		topHoldersPercentage: 31.2,
	},
	stats5m: {
		priceChange: -0.1,
		buyVolume: 13_314,
		sellVolume: 42_314,
		numBuys: 211,
		numSells: 252,
		numTraders: 127,
	},
	stats1h: {
		priceChange: 0.66,
		buyVolume: 613_253,
		sellVolume: 378_612,
		numBuys: 3286,
		numSells: 2999,
		numTraders: 980,
	},
};
const bonk = {
	id: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
	symbol: "Bonk",
	stats1h: { buyVolume: 10 },
};
const usdc = { id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC" };

describe("one token from Jupiter", () => {
	it("reads what is there", () => {
		expect(parseMarketToken(pump, NOW)).toMatchObject({
			symbol: "PUMP",
			priceUsd: 0.0054,
			holders: 292_292,
			ageHours: 24,
			verified: true,
			mintable: false,
			freezable: true,
			topHoldersPct: 31.2,
			m5: { priceChangePct: -0.1, volumeUsd: 55_628, buys: 211, sells: 252, traders: 127 },
			h1: { volumeUsd: 991_865 },
		});
	});

	it("leaves out what is not, rather than calling it zero", () => {
		expect(parseMarketToken({ id: "x" }, NOW)).toMatchObject({
			symbol: "?",
			priceUsd: undefined,
			ageHours: undefined,
			mintable: undefined,
			m5: { volumeUsd: undefined },
		});
		expect(parseMarketToken({ symbol: "no mint" }, NOW)).toBeUndefined();
		expect(parseMarketToken(null, NOW)).toBeUndefined();
	});
});

describe("scanning the market", () => {
	const answers: Record<string, unknown> = {
		toptrending: [pump, bonk, usdc],
		toptraded: [pump],
		toporganicscore: [pump],
	};
	const fetch = vi.fn(async (url: string | URL | Request) => {
		const ranking = /v2\/(\w+)\//.exec(String(url))?.[1] ?? "";
		return new Response(JSON.stringify(answers[ranking] ?? []));
	});

	it("merges Jupiter's rankings into one list, most agreed on first, money left out", async () => {
		const scan = jupiterMarket({ fetch, baseUrl: "https://example.test" });
		const tokens = await scan({ interval: "5m", limit: 20, now: NOW });
		expect(tokens.map((token) => token.symbol)).toEqual(["PUMP", "Bonk"]);
		expect(tokens[0]?.foundBy).toEqual(["trending", "traded", "organicscore"]);
		expect(String(fetch.mock.calls[0]?.[0])).toBe(
			"https://example.test/tokens/v2/toptrending/5m?limit=20",
		);
	});

	it("still answers when one ranking fails", async () => {
		const flaky = vi.fn(async (url: string | URL | Request) =>
			String(url).includes("toptraded") ? new Response("busy", { status: 429 }) : fetch(url),
		);
		const tokens = await jupiterMarket({ fetch: flaky })({ now: NOW });
		expect(tokens).toHaveLength(2);
	});

	it("says so when none can be read", async () => {
		const down = vi.fn(
			async (_url: string | URL | Request, _init?: RequestInit) =>
				new Response("down", { status: 500 }),
		);
		await expect(jupiterMarket({ fetch: down, apiKey: "k" })()).rejects.toThrow(
			"could not be read",
		);
		expect(down.mock.calls[0]?.[1]).toMatchObject({ headers: { "x-api-key": "k" } });
	});

	it("keeps the size of a scan sensible", async () => {
		const counting = vi.fn(async (_url: string | URL | Request) => new Response("[]"));
		await jupiterMarket({ fetch: counting })({ limit: 5000 });
		expect(String(counting.mock.calls[0]?.[0])).toContain("limit=100");
	});

	it("ignores an answer that is not a list", async () => {
		const odd = vi.fn(async () => new Response(JSON.stringify({ not: "a list" })));
		expect(await jupiterMarket({ fetch: odd })()).toEqual([]);
	});
});
