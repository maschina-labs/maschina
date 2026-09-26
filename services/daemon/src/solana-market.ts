/**
 * The node's view of the market: what the wallet holds, and what a swap would look like.
 *
 * A swap is only prepared when an independent price agrees with the router's quote. A router that
 * quotes far from the market is either broken or being gamed, and in both cases the right move is to
 * skip the run and say why, rather than trade.
 */

import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import type { SwapAction } from "@maschina/runtime";
import {
	type BalanceReader,
	balanceOf,
	checkAgainstPrice,
	type MintLookup,
	mintsHeld,
	type PriceSource,
	type PriorityFeeSettings,
	parseAddress,
	readBalances,
	requirePrice,
	type SwapQuote,
	type SwapRouter,
	spendableLamports,
	WRAPPED_SOL,
} from "@maschina/solana";
import type { PreparedSwap, QuotedTrade } from "./machine-runner.ts";

export function solanaMarket(parts: {
	router: SwapRouter;
	prices: PriceSource;
	mints: MintLookup;
	balances: BalanceReader;
	/** What a trade may pay to be included. Also kept back from spendable SOL, so fees can be paid. */
	priorityFee: PriorityFeeSettings;
}) {
	const { router, prices, mints, balances, priorityFee } = parts;
	/** The priority fee cap plus the base fee, which is what a trade can cost to send. */
	const feeReserve = priorityFee.maxLamports + 5_000n;

	/** The quote, checked against a price the router had no hand in. Used by both paths below. */
	async function quoteAndCheck(
		action: SwapAction,
		signal: AbortSignal,
	): Promise<{ ok: true; quote: SwapQuote } | { ok: false; because: string }> {
		const inputMint = parseAddress(action.inputMint);
		const outputMint = parseAddress(action.outputMint);
		const quote = await router.quote(
			{ inputMint, outputMint, amount: action.inputAmount, slippageBps: action.slippageBps },
			signal,
		);

		const [priced, input, output] = await Promise.all([
			prices.usdPrices([inputMint, outputMint], signal),
			mints(inputMint),
			mints(outputMint),
		]);
		const check = checkAgainstPrice({
			quote,
			inputPrice: requirePrice(priced, inputMint, prices.name),
			outputPrice: requirePrice(priced, outputMint, prices.name),
			inputDecimals: input.decimals,
			outputDecimals: output.decimals,
		});
		if (!check.agrees) return { ok: false, because: check.because };

		return { ok: true, quote };
	}

	/** The parts of a quote the rest of the node needs, as plain strings and numbers. */
	const named = (quote: SwapQuote): QuotedTrade => ({
		router: quote.router,
		inputMint: quote.inputMint,
		outputMint: quote.outputMint,
		inputAmount: quote.inputAmount,
		outputAmount: quote.outputAmount,
		minimumOutputAmount: quote.minimumOutputAmount,
		slippageBps: quote.slippageBps,
	});

	return {
		async balances(wallet: string): Promise<ReadonlyMap<string, BaseUnits>> {
			const read = await readBalances(balances, parseAddress(wallet));
			const byMint = new Map<string, BaseUnits>();
			for (const mint of mintsHeld(read)) byMint.set(mint, balanceOf(read, mint));
			// Plain SOL is what a swap spends when it wraps, so it counts as wrapped SOL, less what must
			// stay behind for rent and fees.
			const sol = (byMint.get(WRAPPED_SOL) ?? 0n) + spendableLamports(read, feeReserve);
			byMint.set(WRAPPED_SOL, baseUnitsOf(sol));
			return byMint;
		},

		/**
		 * Quotes the swap and checks it against the independent price, and stops there.
		 *
		 * This is as far as a machine on paper goes. Building would ask the router to simulate the
		 * transaction against a wallet that holds nothing, and it would rightly refuse, so a paper
		 * machine would never get past its own first trade.
		 */
		async quote(
			action: SwapAction,
			signal: AbortSignal,
		): Promise<{ ok: true; quote: QuotedTrade } | { ok: false; because: string }> {
			const checked = await quoteAndCheck(action, signal);
			return checked.ok ? { ok: true, quote: named(checked.quote) } : checked;
		},

		async prepare(
			action: SwapAction,
			wallet: string,
			signal: AbortSignal,
		): Promise<{ ok: true; swap: PreparedSwap } | { ok: false; because: string }> {
			const checked = await quoteAndCheck(action, signal);
			if (!checked.ok) return checked;

			const built = await router.build(
				{ quote: checked.quote, wallet: parseAddress(wallet), priorityFee },
				signal,
			);
			return {
				ok: true,
				swap: {
					transaction: built.transaction,
					lastValidBlockHeight: built.lastValidBlockHeight,
					quote: named(checked.quote),
				},
			};
		},
	};
}
