import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { jupiterPrices, parseJupiterPrices, requirePrice } from "./jupiter-price.ts";
import {
	checkAgainstPrice,
	DEFAULT_PRICE_CHECK,
	type PriceCheckSettings,
	type UsdPrice,
	usdMicrosFrom,
	valueInUsdMicros,
} from "./price.ts";
import type { SwapQuote } from "./router.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const NOW = new Date("2026-09-18T08:00:00.000Z");

const price = (mint: string, micros: bigint, at: Date = NOW): UsdPrice => ({
	mint: parseAddress(mint),
	micros,
	source: "test price",
	at,
});

/** A tenth of a SOL for about 10.5 USDC, which is what the market said when this was written. */
const quote = (over: Partial<SwapQuote> = {}): SwapQuote => ({
	router: "jupiter",
	inputMint: SOL,
	outputMint: USDC,
	inputAmount: 100_000_000n as SwapQuote["inputAmount"],
	outputAmount: 10_540_000n as SwapQuote["outputAmount"],
	minimumOutputAmount: 10_540_000n as SwapQuote["minimumOutputAmount"],
	slippageBps: 50,
	priceImpactBps: 1,
	route: [],
	raw: {},
	...over,
});

const settings = (over: Partial<PriceCheckSettings> = {}): PriceCheckSettings => ({
	...DEFAULT_PRICE_CHECK,
	...over,
});

describe("holding a price as whole micro-dollars", () => {
	it("keeps six decimals and rounds to nearest", () => {
		expect(usdMicrosFrom(105.40231296237027)).toBe(105_402_313n);
		expect(usdMicrosFrom(0.9994996511188577)).toBe(999_500n);
		expect(usdMicrosFrom(1)).toBe(1_000_000n);
		expect(usdMicrosFrom(0.0000004)).toBe(0n);
	});

	it.each([
		["a price that is not a number", Number.NaN],
		["a price that is infinite", Number.POSITIVE_INFINITY],
		["a negative price", -1],
		["a price no token has", 1e16],
	])("refuses %s", (_name, value) => {
		expect(() => usdMicrosFrom(value)).toThrow(MaschinaError);
	});

	it("values an amount without floating point", () => {
		// A tenth of a SOL at $105.402313 is $10.540231.
		expect(valueInUsdMicros(100_000_000n, 9, price(SOL, 105_402_313n))).toBe(10_540_231n);
		expect(valueInUsdMicros(20_000_000n, 6, price(USDC, 999_500n))).toBe(19_990_000n);
	});

	it("refuses impossible decimals", () => {
		expect(() => valueInUsdMicros(1n, 19, price(SOL, 1n))).toThrow(MaschinaError);
	});
});

describe("checking a trade against an independent price", () => {
	const inputPrice = price(SOL, 105_402_313n);
	const outputPrice = price(USDC, 1_000_000n);

	it("agrees when the trade matches the market", () => {
		const result = checkAgainstPrice({
			quote: quote(),
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 6,
			now: NOW,
		});

		expect(result.agrees).toBe(true);
		expect(Math.abs(result.differenceBps)).toBeLessThan(50);
	});

	it("refuses a trade that receives far less than the market says", () => {
		const result = checkAgainstPrice({
			quote: quote({ minimumOutputAmount: 9_000_000n as SwapQuote["minimumOutputAmount"] }),
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 6,
			now: NOW,
		});

		expect(result.agrees).toBe(false);
		expect(result.differenceBps).toBeLessThan(-1000);
		expect(result).toMatchObject({ because: expect.stringContaining("less than") });
	});

	it("refuses a trade that receives far more, because that is usually a mistake", () => {
		const result = checkAgainstPrice({
			quote: quote({ minimumOutputAmount: 10_540_000_000n as SwapQuote["minimumOutputAmount"] }),
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 6,
			now: NOW,
		});

		expect(result.agrees).toBe(false);
		expect(result).toMatchObject({ because: expect.stringContaining("more than") });
	});

	it("judges the floor, not the hope, because the floor is what can actually happen", () => {
		const tooLow = quote({
			outputAmount: 10_540_000n as SwapQuote["outputAmount"],
			minimumOutputAmount: 9_000_000n as SwapQuote["minimumOutputAmount"],
		});

		expect(
			checkAgainstPrice({
				quote: tooLow,
				inputPrice,
				outputPrice,
				inputDecimals: 9,
				outputDecimals: 6,
				now: NOW,
			}).agrees,
		).toBe(false);
	});

	it("takes the tolerance as a setting", () => {
		const slightlyLow = quote({
			minimumOutputAmount: 10_330_000n as SwapQuote["minimumOutputAmount"],
		});
		const shared = {
			quote: slightlyLow,
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 6,
			now: NOW,
		};

		expect(checkAgainstPrice({ ...shared, settings: settings({ toleranceBps: 300 }) }).agrees).toBe(
			true,
		);
		expect(checkAgainstPrice({ ...shared, settings: settings({ toleranceBps: 50 }) }).agrees).toBe(
			false,
		);
	});

	it("refuses a price too old to be evidence", () => {
		const stale = price(USDC, 1_000_000n, new Date(NOW.getTime() - 120_000));

		const result = checkAgainstPrice({
			quote: quote(),
			inputPrice,
			outputPrice: stale,
			inputDecimals: 9,
			outputDecimals: 6,
			now: NOW,
		});

		expect(result.agrees).toBe(false);
		expect(result).toMatchObject({ because: expect.stringContaining("seconds old") });
	});

	it("accepts an old price only when the caller says staleness does not matter", () => {
		const stale = price(USDC, 1_000_000n, new Date(NOW.getTime() - 10 * 60_000));

		expect(
			checkAgainstPrice({
				quote: quote(),
				inputPrice,
				outputPrice: stale,
				inputDecimals: 9,
				outputDecimals: 6,
				settings: { toleranceBps: 300, maxAgeMs: Number.POSITIVE_INFINITY },
				now: NOW,
			}).agrees,
		).toBe(true);
	});

	it("refuses prices for the wrong tokens", () => {
		expect(() =>
			checkAgainstPrice({
				quote: quote(),
				inputPrice: price(USDC, 1_000_000n),
				outputPrice,
				inputDecimals: 9,
				outputDecimals: 6,
				now: NOW,
			}),
		).toThrow(/other tokens/);
	});

	it("refuses a tolerance that is not a whole number of basis points", () => {
		expect(() =>
			checkAgainstPrice({
				quote: quote(),
				inputPrice,
				outputPrice,
				inputDecimals: 9,
				outputDecimals: 6,
				settings: settings({ toleranceBps: 1.5 }),
				now: NOW,
			}),
		).toThrow(MaschinaError);
	});

	it("refuses a trade that spends nothing", () => {
		expect(() =>
			checkAgainstPrice({
				quote: quote({ inputAmount: 0n as SwapQuote["inputAmount"] }),
				inputPrice,
				outputPrice,
				inputDecimals: 9,
				outputDecimals: 6,
				now: NOW,
			}),
		).toThrow(MaschinaError);
	});

	it("catches a decimals mistake, which is what this check is really for", () => {
		// Reading USDC as nine decimals instead of six makes the trade look a thousand times worse.
		const result = checkAgainstPrice({
			quote: quote(),
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 9,
			now: NOW,
		});

		expect(result.agrees).toBe(false);
	});
});

describe("reading prices from Jupiter", () => {
	const body = {
		[SOL]: { usdPrice: 105.40231296237027, blockId: 448_025_627, decimals: 9 },
		[USDC]: { usdPrice: 0.9994996511188577, blockId: 448_025_627, decimals: 6 },
	};

	it("reads a price for each token", () => {
		const prices = parseJupiterPrices(body, NOW);

		expect(prices.get(SOL)?.micros).toBe(105_402_313n);
		expect(prices.get(USDC)?.micros).toBe(999_500n);
		expect(prices.get(SOL)?.at).toBe(NOW);
	});

	it("skips an entry that is not a price at all", () => {
		expect(parseJupiterPrices({ [SOL]: null }, NOW).size).toBe(0);
	});

	it.each([
		["an answer that is not an object", "nope"],
		["a price that is not a number", { [SOL]: { usdPrice: "105" } }],
		["a price of zero", { [SOL]: { usdPrice: 0 } }],
		["a negative price", { [SOL]: { usdPrice: -1 } }],
	])("refuses %s", (_name, value) => {
		expect(() => parseJupiterPrices(value, NOW)).toThrow(MaschinaError);
	});

	it("says clearly when a token has no price", () => {
		const prices = parseJupiterPrices(body, NOW);

		expect(requirePrice(prices, SOL).micros).toBe(105_402_313n);
		expect(() =>
			requirePrice(prices, parseAddress("11111111111111111111111111111111"), "jupiter price"),
		).toThrow(/no price for this token/);
	});

	it("asks for every mint in one request", async () => {
		let asked: URL | undefined;
		const source = jupiterPrices({
			now: () => NOW,
			fetch: ((url: URL) => {
				asked = url;
				return Promise.resolve(
					new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
				);
			}) as unknown as typeof fetch,
		});

		const prices = await source.usdPrices([SOL, USDC]);

		expect(asked?.pathname).toBe("/price/v3");
		expect(asked?.searchParams.get("ids")).toBe(`${SOL},${USDC}`);
		expect(prices.size).toBe(2);
	});

	it("asks nobody when there is nothing to ask about", async () => {
		let asked = false;
		const source = jupiterPrices({
			fetch: (() => {
				asked = true;
				return Promise.resolve(new Response("{}"));
			}) as unknown as typeof fetch,
		});

		expect((await source.usdPrices([])).size).toBe(0);
		expect(asked).toBe(false);
	});

	it("refuses to ask about more tokens than the API allows", async () => {
		const source = jupiterPrices();
		const many = Array.from({ length: 51 }, () => SOL);

		await expect(source.usdPrices(many)).rejects.toThrow(/at most 50/);
	});

	it("calls a rate limit a limit, and a broken API unavailable", async () => {
		const limited = jupiterPrices({
			fetch: (() => Promise.resolve(new Response("slow down", { status: 429 }))) as typeof fetch,
		});
		const broken = jupiterPrices({
			fetch: (() => Promise.resolve(new Response("bad", { status: 503 }))) as typeof fetch,
		});

		await expect(limited.usdPrices([SOL])).rejects.toMatchObject({ code: "limit_exceeded" });
		await expect(broken.usdPrices([SOL])).rejects.toMatchObject({ code: "unavailable" });
	});

	it("uses the paid endpoint when there is a key", async () => {
		let headers: unknown;
		const source = jupiterPrices({
			apiKey: "a-key",
			fetch: ((_url: URL, init: RequestInit) => {
				headers = init.headers;
				return Promise.resolve(new Response(JSON.stringify(body)));
			}) as unknown as typeof fetch,
		});

		await source.usdPrices([SOL]);
		expect(headers).toEqual({ "x-api-key": "a-key" });
		expect(source.name).toBe("jupiter price");
	});
});
