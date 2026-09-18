/**
 * Quotes from the real Jupiter API.
 *
 * Prices move, so nothing here asserts a number. What is checked is the shape of the truth: the quote
 * answers the question that was asked, its floor is never above its expectation, and a pair with no
 * route fails as a refusal rather than as nonsense.
 */

import { jupiterRouter, parseAddress, quotedPrice } from "@maschina/solana";
import { describe, expect, it } from "vitest";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/** The paid endpoint when a key is configured, the keyless one otherwise. */
const router = jupiterRouter({
	...(process.env["JUPITER_API_KEY"] ? { apiKey: process.env["JUPITER_API_KEY"] } : {}),
	timeoutMs: 15_000,
});

const tenthOfASol = 100_000_000n as Parameters<typeof router.quote>[0]["amount"];

describe("a live quote", () => {
	it("answers the question that was asked", async () => {
		const quote = await router.quote({
			inputMint: SOL,
			outputMint: USDC,
			amount: tenthOfASol,
			slippageBps: 50,
		});

		expect(quote.router).toBe("jupiter");
		expect(quote.inputMint).toBe(SOL);
		expect(quote.outputMint).toBe(USDC);
		expect(quote.inputAmount).toBe(tenthOfASol);
		expect(quote.outputAmount).toBeGreaterThan(0n);
		expect(quote.route.length).toBeGreaterThan(0);
	});

	it("never promises more than its floor, and the floor is within the slippage asked for", async () => {
		const slippageBps = 50;
		const quote = await router.quote({
			inputMint: SOL,
			outputMint: USDC,
			amount: tenthOfASol,
			slippageBps,
		});

		expect(quote.minimumOutputAmount).toBeLessThanOrEqual(quote.outputAmount);
		// The floor may be at most the slippage below the expectation, never further.
		const worst = (quote.outputAmount * BigInt(10_000 - slippageBps)) / 10_000n;
		expect(quote.minimumOutputAmount).toBeGreaterThanOrEqual(worst - 1n);
	});

	it("prices a whole SOL somewhere a human would recognise", async () => {
		const quote = await router.quote({
			inputMint: SOL,
			outputMint: USDC,
			amount: tenthOfASol,
			slippageBps: 50,
		});

		// Wide on purpose: this catches a decimals mistake or a broken price, not a market move.
		const perSol = quotedPrice(quote, 9);
		expect(perSol).toBeGreaterThan(1_000_000n);
		expect(perSol).toBeLessThan(100_000_000_000n);
	});

	it("refuses a pair with no route instead of inventing one", async () => {
		// A real mint with no market against SOL: the incinerator's own token account address is not a
		// mint, so this uses a mint that exists and has no liquidity.
		const noMarket = parseAddress("HskCS1LhkLU5H3JJBkGAoQjVPdzxNoJdc7L5sLXf1CJh");

		await expect(
			router.quote({
				inputMint: SOL,
				outputMint: noMarket,
				amount: tenthOfASol,
				slippageBps: 50,
			}),
		).rejects.toMatchObject({ code: expect.stringMatching(/not_found|invalid_input/) });
	});
});
