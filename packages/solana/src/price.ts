/**
 * A second opinion on what a token is worth.
 *
 * A router's quote is the only price a machine would otherwise see, and a quote can be wrong in ways
 * that cost money: a pool that has been drained, a route through a manipulated market, a mint whose
 * decimals we read wrong. So before anything is signed, the trade is valued against an independent
 * price, and a trade that is far from it is skipped rather than made.
 *
 * Prices are held as whole micro-dollars (six decimals), so nothing here does floating point
 * arithmetic. The source may hand over a floating point number, and that conversion happens once, at
 * the edge, with the rounding written down.
 */

import { MaschinaError } from "@maschina/core";
import type { Address } from "./address.ts";
import type { SwapQuote } from "./router.ts";

/** How many whole units one token is worth in dollars, times a million. */
export type UsdPrice = {
	mint: Address;
	/** Dollars per whole token, in micro-dollars. $105.402312 is 105_402_312n. */
	micros: bigint;
	source: string;
	at: Date;
};

export type PriceSource = {
	name: string;
	/** Prices several mints at once, because asking one at a time is slow and rate limited. */
	usdPrices(mints: Address[], signal?: AbortSignal): Promise<Map<Address, UsdPrice>>;
};

export const USD_SCALE = 1_000_000n;

/**
 * Turns a price that arrived as a JavaScript number into whole micro-dollars.
 *
 * The number is printed at full precision first and read as digits, so the conversion never compounds
 * the floating point error it inherits. Rounding is to nearest, since this is a reference price rather
 * than an amount anyone is paid.
 */
export function usdMicrosFrom(value: number): bigint {
	if (!Number.isFinite(value) || value < 0) {
		throw new MaschinaError("invalid_input", "a price must be a finite number above zero", {
			details: { value },
		});
	}
	// toFixed(6) rounds to nearest at the digit we keep, and never uses exponent notation for the
	// range any real token price lives in.
	if (value >= 1e15) {
		throw new MaschinaError("invalid_input", "that price is not a real price", {
			details: { value },
		});
	}
	const [whole = "0", fraction = ""] = value.toFixed(6).split(".");
	return BigInt(whole) * USD_SCALE + BigInt(fraction.padEnd(6, "0"));
}

/** What an amount of a token is worth, in whole micro-dollars. */
export function valueInUsdMicros(amount: bigint, decimals: number, price: UsdPrice): bigint {
	if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
		throw new MaschinaError("invalid_input", "a token's decimals are out of range");
	}
	return (amount * price.micros) / 10n ** BigInt(decimals);
}

export type PriceCheckSettings = {
	/**
	 * How far the trade may sit from the independent price before the run is skipped, in basis points.
	 * This is a setting because the right number depends on the pair: stablecoins move in tenths of a
	 * percent, small tokens move in whole percent.
	 */
	toleranceBps: number;
	/** How stale an independent price may be before it is not independent evidence any more. */
	maxAgeMs?: number;
};

export const DEFAULT_PRICE_CHECK: PriceCheckSettings = {
	toleranceBps: 300,
	maxAgeMs: 60_000,
};

export type PriceCheck =
	| { agrees: true; differenceBps: number }
	| { agrees: false; differenceBps: number; because: string };

export type PriceCheckInput = {
	quote: SwapQuote;
	inputPrice: UsdPrice;
	outputPrice: UsdPrice;
	inputDecimals: number;
	outputDecimals: number;
	settings?: PriceCheckSettings;
	now?: Date;
};

/**
 * Compares what the trade gives up with what it receives, valued independently.
 *
 * Getting less than the independent price says is the dangerous direction, and is the reason this check
 * exists. Getting far more is not a windfall, it is evidence that something is wrong, usually a decimals
 * mistake, so both directions stop the run.
 */
export function checkAgainstPrice(input: PriceCheckInput): PriceCheck {
	const {
		quote,
		inputPrice,
		outputPrice,
		inputDecimals,
		outputDecimals,
		settings = DEFAULT_PRICE_CHECK,
		now = new Date(),
	} = input;

	if (inputPrice.mint !== quote.inputMint || outputPrice.mint !== quote.outputMint) {
		throw new MaschinaError("invalid_input", "these prices are for other tokens");
	}
	if (!Number.isInteger(settings.toleranceBps) || settings.toleranceBps < 0) {
		throw new MaschinaError(
			"invalid_input",
			"the tolerance must be a whole number of basis points",
		);
	}

	const maxAgeMs = settings.maxAgeMs ?? DEFAULT_PRICE_CHECK.maxAgeMs;
	if (maxAgeMs !== undefined) {
		for (const price of [inputPrice, outputPrice]) {
			const age = now.getTime() - price.at.getTime();
			if (age > maxAgeMs) {
				return {
					agrees: false,
					differenceBps: 0,
					because: `the ${price.source} price is ${Math.round(age / 1000)} seconds old`,
				};
			}
		}
	}

	const spending = valueInUsdMicros(quote.inputAmount, inputDecimals, inputPrice);
	const receiving = valueInUsdMicros(quote.minimumOutputAmount, outputDecimals, outputPrice);

	if (spending <= 0n) {
		throw new MaschinaError("invalid_amount", "a trade that spends nothing cannot be checked");
	}

	// Positive means the trade receives more than the independent price expects.
	const differenceBps = Number(((receiving - spending) * 10_000n) / spending);

	if (differenceBps < -settings.toleranceBps) {
		return {
			agrees: false,
			differenceBps,
			because: `the trade receives ${Math.abs(differenceBps) / 100}% less than the ${outputPrice.source} price`,
		};
	}
	if (differenceBps > settings.toleranceBps) {
		return {
			agrees: false,
			differenceBps,
			because: `the trade receives ${differenceBps / 100}% more than the ${outputPrice.source} price, which usually means a mistake`,
		};
	}
	return { agrees: true, differenceBps };
}
