/**
 * What a swap router has to be able to do, whoever it is.
 *
 * Jupiter is the first one, Orca answers on devnet, and a second mainnet router comes later. None of
 * them is allowed to be special: a machine asks for a quote, reads the same fields back, and decides.
 * Anything a particular router needs to build its own transaction rides along untouched in `raw`.
 *
 * A quote is a claim about the future, so the number that matters is not `outputAmount`, which is what
 * the router hopes for. It is `minimumOutputAmount`: the least the trade may produce before it fails
 * instead. Every rule reads that one.
 */

import type { BaseUnits } from "@maschina/core";
import type { Address } from "./address.ts";
import type { BuildSwapRequest, UnsignedSwap } from "./swap-transaction.ts";

export type QuoteRequest = {
	inputMint: Address;
	outputMint: Address;
	/** How much to spend, in the input token's smallest unit. */
	amount: BaseUnits;
	/** The most price movement the machine will accept, in basis points. 100 bps is one percent. */
	slippageBps: number;
};

/** One leg of the path a swap takes, for the record and for anyone reading it later. */
export type RouteStep = {
	/** The pool or market, as the router names it. */
	label: string;
	inputMint: Address;
	outputMint: Address;
	percent: number;
};

export type SwapQuote = {
	/** Which router answered, so the record says where a price came from. */
	router: string;
	inputMint: Address;
	outputMint: Address;
	inputAmount: BaseUnits;
	/** What the router expects the trade to produce. */
	outputAmount: BaseUnits;
	/** The least the trade may produce. Below this it fails rather than filling. */
	minimumOutputAmount: BaseUnits;
	slippageBps: number;
	/** How far this trade moves the price, in basis points, as the router measured it. */
	priceImpactBps: number;
	route: RouteStep[];
	/** The router's own answer, kept whole so the transaction can be built from exactly this quote. */
	raw: unknown;
};

export type SwapRouter = {
	name: string;
	quote(request: QuoteRequest, signal?: AbortSignal): Promise<SwapQuote>;
	/** Builds the transaction for a quote. The quote goes back to the router exactly as it arrived. */
	build(request: BuildSwapRequest, signal?: AbortSignal): Promise<UnsignedSwap>;
};

/** The most slippage Maschina will ask any router for: ten percent, which is already reckless. */
export const MAX_SLIPPAGE_BPS = 1000;
