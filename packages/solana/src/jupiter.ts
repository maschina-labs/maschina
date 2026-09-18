/**
 * Quotes from Jupiter.
 *
 * Jupiter is an outside service on the path to spending money, so its answers are treated the way any
 * untrusted input is: every amount is checked, the mints are checked against what was asked for, and a
 * quote whose own numbers disagree with each other is refused rather than traded.
 *
 * Errors are turned into codes on the way out, because the run loop decides what to do from the code and
 * never from a message. A rate limit is something to wait through, no route is something that will not
 * work however many times it is tried, and a failed request is something to try again.
 */

import { type BaseUnits, baseUnitsOf, MaschinaError } from "@maschina/core";
import { parseAddress } from "./address.ts";
import { MAX_SLIPPAGE_BPS, type QuoteRequest, type RouteStep, type SwapQuote } from "./router.ts";
import { type BuildSwapRequest, parseBuiltSwap, type UnsignedSwap } from "./swap-transaction.ts";

export const JUPITER_API = "https://api.jup.ag";
/** The keyless endpoint, which answers at about one request a second. A fallback, not the default. */
export const JUPITER_LITE_API = "https://lite-api.jup.ag";

export type JupiterOptions = {
	baseUrl?: string;
	apiKey?: string;
	/** How long to wait for a quote. A stale quote is worthless, so this is short by design. */
	timeoutMs?: number;
	fetch?: typeof globalThis.fetch;
};

const DEFAULT_TIMEOUT_MS = 8000;

const digits = /^\d+$/;

const amount = (value: unknown, field: string): BaseUnits => {
	if (typeof value !== "string" || !digits.test(value)) {
		throw new MaschinaError("invalid_input", `the quote's ${field} is not a whole amount`, {
			details: { [field]: value },
		});
	}
	return baseUnitsOf(BigInt(value));
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

/**
 * Price impact arrives as a decimal fraction in a string ("0.0012" is 0.12%). It is read as basis
 * points and rounded up, so a trade is never reported as gentler than it is.
 */
function priceImpactBps(value: unknown): number {
	if (value === undefined || value === null) return 0;
	const text = typeof value === "number" ? String(value) : value;
	if (typeof text !== "string") {
		throw new MaschinaError("invalid_input", "the quote's price impact is not a number");
	}
	const parsed = Number(text);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new MaschinaError("invalid_input", "the quote's price impact is not a number", {
			details: { priceImpact: text },
		});
	}
	return Math.ceil(parsed * 10_000);
}

function routeSteps(value: unknown): RouteStep[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new MaschinaError("invalid_input", "the quote has no route");
	}
	return value.map((entry) => {
		const step = asRecord(entry);
		const swap = asRecord(step?.["swapInfo"]);
		const label = swap?.["label"];
		const inputMint = swap?.["inputMint"];
		const outputMint = swap?.["outputMint"];
		if (typeof inputMint !== "string" || typeof outputMint !== "string") {
			throw new MaschinaError("invalid_input", "a step in the route is missing its tokens");
		}
		const percent = step?.["percent"];
		return {
			label: typeof label === "string" ? label : "unknown",
			inputMint: parseAddress(inputMint),
			outputMint: parseAddress(outputMint),
			percent: typeof percent === "number" ? percent : 100,
		};
	});
}

/** Reads a Jupiter quote, refusing anything that does not answer the question that was asked. */
export function parseJupiterQuote(request: QuoteRequest, body: unknown): SwapQuote {
	const quote = asRecord(body);
	if (!quote) throw new MaschinaError("invalid_input", "the router's answer is not a quote");

	if (quote["inputMint"] !== request.inputMint || quote["outputMint"] !== request.outputMint) {
		// A quote for different tokens than the ones asked about is not a quote, it is an accident.
		throw new MaschinaError("invalid_input", "the quote is for different tokens", {
			details: {
				asked: { input: request.inputMint, output: request.outputMint },
				got: { input: quote["inputMint"], output: quote["outputMint"] },
			},
		});
	}

	if (quote["swapMode"] !== undefined && quote["swapMode"] !== "ExactIn") {
		throw new MaschinaError("invalid_input", "only exact input swaps are supported", {
			details: { swapMode: quote["swapMode"] },
		});
	}

	const inputAmount = amount(quote["inAmount"], "input amount");
	if (inputAmount !== request.amount) {
		throw new MaschinaError("invalid_input", "the quote is for a different amount", {
			details: { asked: request.amount.toString(), got: inputAmount.toString() },
		});
	}

	const outputAmount = amount(quote["outAmount"], "output amount");
	const minimumOutputAmount = amount(quote["otherAmountThreshold"], "minimum output amount");
	if (outputAmount === 0n) {
		throw new MaschinaError("not_found", "no route found: the quote produces nothing");
	}
	if (minimumOutputAmount > outputAmount) {
		// The floor cannot be above the expectation. A router saying so is broken or lying.
		throw new MaschinaError("invalid_input", "the quote's minimum is above its expected output", {
			details: {
				outputAmount: outputAmount.toString(),
				minimumOutputAmount: minimumOutputAmount.toString(),
			},
		});
	}

	const slippageBps = quote["slippageBps"];
	if (typeof slippageBps !== "number" || !Number.isInteger(slippageBps) || slippageBps < 0) {
		throw new MaschinaError("invalid_input", "the quote's slippage is not a whole number");
	}
	if (slippageBps > request.slippageBps) {
		throw new MaschinaError("invalid_input", "the quote allows more slippage than was asked for", {
			details: { asked: request.slippageBps, got: slippageBps },
		});
	}

	return {
		router: "jupiter",
		inputMint: request.inputMint,
		outputMint: request.outputMint,
		inputAmount,
		outputAmount,
		minimumOutputAmount,
		slippageBps,
		priceImpactBps: priceImpactBps(quote["priceImpactPct"]),
		route: routeSteps(quote["routePlan"]),
		raw: body,
	};
}

/** Refuses a request that should never reach a router. */
export function checkQuoteRequest(request: QuoteRequest): void {
	if (request.inputMint === request.outputMint) {
		throw new MaschinaError("invalid_input", "a swap needs two different tokens");
	}
	if (request.amount <= 0n) {
		throw new MaschinaError("invalid_amount", "a swap needs an amount above zero");
	}
	if (
		!Number.isInteger(request.slippageBps) ||
		request.slippageBps < 0 ||
		request.slippageBps > MAX_SLIPPAGE_BPS
	) {
		throw new MaschinaError(
			"invalid_input",
			`slippage must be a whole number of basis points from 0 to ${MAX_SLIPPAGE_BPS}`,
		);
	}
}

/** Turns an unhappy response into an error whose code says what to do about it. */
async function failureFor(response: Response): Promise<MaschinaError> {
	const text = await response.text().catch(() => "");
	const detail = text.slice(0, 500);

	if (response.status === 429) {
		const retryAfter = response.headers.get("retry-after");
		return new MaschinaError(
			"limit_exceeded",
			`rate limit from the router${retryAfter ? `, retry after ${retryAfter}` : ""}`,
			{ details: { status: response.status, detail } },
		);
	}
	if (response.status === 401 || response.status === 403) {
		return new MaschinaError("forbidden", "the router refused our credentials", {
			details: { status: response.status },
		});
	}
	if (/no route|not_found|could not find any route/i.test(detail)) {
		return new MaschinaError("not_found", "no route found for this pair", {
			details: { status: response.status, detail },
		});
	}
	if (response.status >= 500) {
		return new MaschinaError("unavailable", `the router is unavailable (${response.status})`, {
			details: { detail },
		});
	}
	return new MaschinaError("invalid_input", `the router refused the request (${response.status})`, {
		details: { detail },
	});
}

/** A swap router backed by Jupiter. */
export function jupiterRouter(options: JupiterOptions = {}) {
	const baseUrl = (options.baseUrl ?? (options.apiKey ? JUPITER_API : JUPITER_LITE_API)).replace(
		/\/$/,
		"",
	);
	const call = options.fetch ?? globalThis.fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	return {
		name: "jupiter",

		async quote(request: QuoteRequest, signal?: AbortSignal): Promise<SwapQuote> {
			checkQuoteRequest(request);

			const url = new URL(`${baseUrl}/swap/v1/quote`);
			url.searchParams.set("inputMint", request.inputMint);
			url.searchParams.set("outputMint", request.outputMint);
			url.searchParams.set("amount", request.amount.toString());
			url.searchParams.set("slippageBps", String(request.slippageBps));
			// Routes through tokens Jupiter considers reliable, rather than the absolute best price
			// through anything at all. A slightly worse price is cheaper than a route that fails.
			url.searchParams.set("restrictIntermediateTokens", "true");

			const timeout = AbortSignal.timeout(timeoutMs);
			const response = await call(url, {
				headers: options.apiKey ? { "x-api-key": options.apiKey } : {},
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
			});

			if (!response.ok) throw await failureFor(response);

			const body: unknown = await response.json();
			return parseJupiterQuote(request, body);
		},

		/**
		 * Asks Jupiter to build the transaction for a quote it gave us.
		 *
		 * The quote goes back exactly as it arrived. Jupiter prices a route against pools that move, so a
		 * transaction built from an edited quote would be built against a different trade than the one
		 * that was checked.
		 */
		async build(request: BuildSwapRequest, signal?: AbortSignal): Promise<UnsignedSwap> {
			const timeout = AbortSignal.timeout(timeoutMs);
			const response = await call(new URL(`${baseUrl}/swap/v1/swap`), {
				method: "POST",
				headers: {
					"content-type": "application/json",
					...(options.apiKey ? { "x-api-key": options.apiKey } : {}),
				},
				body: JSON.stringify({
					quoteResponse: request.quote.raw,
					userPublicKey: request.wallet,
					// The machine holds SOL, not wrapped SOL, so wrapping is part of the trade itself.
					wrapAndUnwrapSol: true,
					// Asks for a compute limit measured from a simulation rather than the maximum, so the
					// machine is not paying for compute it never uses.
					dynamicComputeUnitLimit: true,
				}),
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
			});

			if (!response.ok) throw await failureFor(response);

			return parseBuiltSwap(request, await response.json());
		},
	};
}

export type JupiterRouter = ReturnType<typeof jupiterRouter>;

/** What a quote is worth per whole input token, for showing a price without floating point drift. */
export function quotedPrice(quote: SwapQuote, inputDecimals: number): bigint {
	const scale = 10n ** BigInt(inputDecimals);
	return (quote.outputAmount * scale) / quote.inputAmount;
}
