import { describe, expect, it, vi } from "vitest";
import { fetchPrice, readPrice, SOL } from "./price.ts";

const body = { [SOL]: { usdPrice: 118.62645, priceChange24h: -2.2053 } };

describe("the SOL price", () => {
	it("reads Jupiter's price and its move over a day", () => {
		expect(readPrice(body, SOL)).toEqual({ usd: 118.62645, change24h: -2.2053 });
	});

	it("gives nothing rather than a zero or a broken number", () => {
		expect(readPrice({ [SOL]: { usdPrice: 0 } }, SOL)).toBeUndefined();
		expect(readPrice({ [SOL]: { usdPrice: "abc" } }, SOL)).toBeUndefined();
		expect(readPrice({}, SOL)).toBeUndefined();
		expect(readPrice(null, SOL)).toBeUndefined();
	});

	it("treats a missing day's move as no move", () => {
		expect(readPrice({ [SOL]: { usdPrice: 120 } }, SOL)?.change24h).toBe(0);
	});

	it("asks Jupiter for exactly the token wanted", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify(body)));
		await fetchPrice(SOL, fetcher as never);
		expect(fetcher).toHaveBeenCalledWith(`https://lite-api.jup.ag/price/v3?ids=${SOL}`);
	});

	it("says so when there is no price", async () => {
		const down = vi.fn(async () => new Response("", { status: 429 }));
		await expect(fetchPrice(SOL, down as never)).rejects.toThrow(/429/);
		const empty = vi.fn(async () => new Response("{}"));
		await expect(fetchPrice(SOL, empty as never)).rejects.toThrow(/without a number/);
	});
});
