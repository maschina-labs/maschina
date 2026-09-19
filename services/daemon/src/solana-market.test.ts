import { baseUnitsOf } from "@maschina/core";
import type { BalanceReader, MintLookup, PriceSource, SwapRouter } from "@maschina/solana";
import { parseAddress } from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { solanaMarket } from "./solana-market.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");

/** 5 USDC for about 0.035 SOL, when SOL is $142. */
const quote = {
	router: "jupiter",
	inputMint: USDC,
	outputMint: SOL,
	inputAmount: baseUnitsOf(5_000_000n),
	outputAmount: baseUnitsOf(35_200_000n),
	minimumOutputAmount: baseUnitsOf(35_000_000n),
	slippageBps: 50,
	route: [],
	priceImpactPct: 0,
};

function market(options: { solPrice?: bigint; built?: boolean } = {}) {
	const asked: string[] = [];
	const router = {
		name: "jupiter",
		quote: async () => {
			asked.push("quote");
			return quote;
		},
		build: async () => {
			asked.push("build");
			return { transaction: new Uint8Array([7]), lastValidBlockHeight: 1000n, quote };
		},
	} as unknown as SwapRouter;
	const at = new Date();
	const prices: PriceSource = {
		name: "jupiter-price",
		usdPrices: async () =>
			new Map([
				[USDC, { mint: USDC, micros: 1_000_000n, source: "jupiter-price", at }],
				[SOL, { mint: SOL, micros: options.solPrice ?? 142_000_000n, source: "jupiter-price", at }],
			]),
	};
	const mints: MintLookup = async (mint) =>
		({ mint, decimals: mint === SOL ? 9 : 6 }) as unknown as Awaited<ReturnType<MintLookup>>;
	const balances: BalanceReader = {
		lamportsOf: async () => 2_000_000_000n,
		tokenAccountsOf: async () => [],
	};
	return {
		asked,
		market: solanaMarket({
			router,
			prices,
			mints,
			balances,
			priorityFee: { maxLamports: 200_000n, level: "high" },
		}),
	};
}

const action = {
	do: "swap" as const,
	inputMint: USDC,
	outputMint: SOL,
	inputAmount: baseUnitsOf(5_000_000n),
	slippageBps: 50,
};
const signal = new AbortController().signal;

describe("preparing a swap", () => {
	it("quotes, checks the quote against the independent price, then builds", async () => {
		const { market: m, asked } = market();
		const prepared = await m.prepare(action, WALLET, signal);

		expect(prepared.ok).toBe(true);
		expect(asked).toEqual(["quote", "build"]);
	});

	it("refuses to build when the quote is far from the independent price", async () => {
		// SOL at $100 makes 0.035 SOL worth $3.50 for $5: far worse than the price says.
		const { market: m, asked } = market({ solPrice: 100_000_000n });
		const prepared = await m.prepare(action, WALLET, signal);

		expect(prepared.ok).toBe(false);
		expect(asked).toEqual(["quote"]);
	});
});

describe("reading balances", () => {
	it("counts spendable SOL under wrapped SOL's mint, keeping rent and a fee reserve back", async () => {
		const { market: m } = market();
		const read = await m.balances(WALLET);
		// 2 SOL, less rent (890,880) and the fee reserve (205,000).
		expect(read.get(SOL)).toBe(2_000_000_000n - 890_880n - 205_000n);
	});
});
