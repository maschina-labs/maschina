import { describe, expect, it, vi } from "vitest";
import { dexScreenerPrices, parseDexPrices } from "./dexscreener-price.ts";

const pair = (mint: string, price: string, depth: number, chainId = "solana") => ({
	chainId,
	priceUsd: price,
	liquidity: { usd: depth },
	baseToken: { address: mint },
});

describe("DexScreener prices", () => {
	it("takes each token's deepest Solana pool", () => {
		const prices = parseDexPrices([
			pair("A", "1.00", 10),
			pair("A", "1.10", 500),
			pair("B", "2", 5),
			pair("C", "9", 900, "base"),
		]);
		expect(prices).toEqual(
			new Map([
				["A", 1.1],
				["B", 2],
			]),
		);
	});

	it("ignores what is not a price", () => {
		expect(
			parseDexPrices([pair("A", "nope", 1), pair("B", "0", 1), { chainId: "solana" }]),
		).toEqual(new Map());
		expect(parseDexPrices({ not: "a list" })).toEqual(new Map());
	});

	it("asks thirty tokens at a time", async () => {
		const fetch = vi.fn(
			async (_url: string | URL | Request) => new Response(JSON.stringify([pair("A", "1", 1)])),
		);
		const mints = Array.from({ length: 31 }, (_, i) => `M${i}`);
		const prices = await dexScreenerPrices({ fetch, baseUrl: "https://example.test" })(mints);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(String(fetch.mock.calls[1]?.[0])).toBe("https://example.test/tokens/v1/solana/M30");
		expect(prices.get("A")).toBe(1);
	});

	it("fails loudly when DexScreener says no", async () => {
		const fetch = vi.fn(async () => new Response("slow down", { status: 429 }));
		await expect(dexScreenerPrices({ fetch })(["A"])).rejects.toThrow("DexScreener answered 429");
	});
});
