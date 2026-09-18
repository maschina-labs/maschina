/**
 * A real quote checked against a real independent price.
 *
 * This is the guard that stands between a machine and a bad trade, so it is proved against the live
 * market rather than fixtures: a normal quote agrees with the price, and a quote read with the wrong
 * decimals is caught.
 */

import {
	checkAgainstPrice,
	jupiterPrices,
	jupiterRouter,
	parseAddress,
	requirePrice,
	type SwapQuote,
} from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { live } from "./support/live.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const key = process.env["JUPITER_API_KEY"];
const router = jupiterRouter({ ...(key ? { apiKey: key } : {}), timeoutMs: 15_000 });
const prices = jupiterPrices({ ...(key ? { apiKey: key } : {}), timeoutMs: 15_000 });

const tenthOfASol = 100_000_000n as SwapQuote["inputAmount"];

async function liveQuoteAndPrices() {
	const quote = await live(() =>
		router.quote({
			inputMint: SOL,
			outputMint: USDC,
			amount: tenthOfASol,
			slippageBps: 50,
		}),
	);
	const found = await live(() => prices.usdPrices([SOL, USDC]));
	return {
		quote,
		inputPrice: requirePrice(found, SOL, prices.name),
		outputPrice: requirePrice(found, USDC, prices.name),
	};
}

describe("a live quote against a live price", () => {
	it("agrees, because a real market and a real price agree", async () => {
		const { quote, inputPrice, outputPrice } = await liveQuoteAndPrices();

		const result = checkAgainstPrice({
			quote,
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 6,
		});

		expect(result.agrees).toBe(true);
		expect(Math.abs(result.differenceBps)).toBeLessThan(300);
	});

	it("catches the trade being read with the wrong decimals", async () => {
		const { quote, inputPrice, outputPrice } = await liveQuoteAndPrices();

		const result = checkAgainstPrice({
			quote,
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			// USDC has six. Reading it as nine makes the trade look a thousand times worse than it is.
			outputDecimals: 9,
		});

		expect(result.agrees).toBe(false);
	});

	it("catches a quote that would receive far too little", async () => {
		const { quote, inputPrice, outputPrice } = await liveQuoteAndPrices();

		const result = checkAgainstPrice({
			quote: {
				...quote,
				minimumOutputAmount: (quote.minimumOutputAmount / 2n) as typeof quote.minimumOutputAmount,
			},
			inputPrice,
			outputPrice,
			inputDecimals: 9,
			outputDecimals: 6,
		});

		expect(result.agrees).toBe(false);
		expect(result.differenceBps).toBeLessThan(-4000);
	});
});
