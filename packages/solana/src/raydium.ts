/**
 * Quotes and transactions from Raydium.
 *
 * The second router. Not because two prices are nicer than one, but because a single router is a single
 * point of failure on the path to every trade: if it is down, slow, or quietly worse, a machine has no
 * way to know. Two routers answering the same question make both of those visible.
 *
 * Raydium answers a narrower question than Jupiter, since it routes through its own pools rather than
 * the whole market. That is part of what makes the comparison useful.
 *
 * One difference matters and is handled deliberately: Raydium does not say when its transaction expires.
 * Sending a transaction without knowing that means never being able to say for certain that it failed,
 * so this router refuses to build one unless it is given a way to read the chain's height.
 */

import { type BaseUnits, baseUnitsOf, MaschinaError } from "@maschina/core";
import { parseAddress } from "./address.ts";
import { MAX_SLIPPAGE_BPS, type QuoteRequest, type RouteStep, type SwapQuote } from "./router.ts";
import { type BuildSwapRequest, parseBuiltSwap, type UnsignedSwap } from "./swap-transaction.ts";

export const RAYDIUM_API = "https://transaction-v1.raydium.io";

/**
 * How many blocks a blockhash stays usable for. Solana's own limit, and the reason a transaction cannot
 * hang around forever waiting to land.
 */
export const BLOCKHASH_LIFETIME_BLOCKS = 150n;

export type RaydiumOptions = {
	baseUrl?: string;
	timeoutMs?: number;
	fetch?: typeof globalThis.fetch;
	/**
	 * Reads the chain's current block height. Required to build a transaction, because Raydium does not
	 * say when one expires and a transaction with an unknown expiry can never be called dead.
	 */
	blockHeight?: () => Promise<bigint>;
	/** What to pay per compute unit, in micro-lamports. */
	computeUnitPriceMicroLamports?: bigint;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_COMPUTE_PRICE = 5000n;

const digits = /^\d+$/;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const amount = (value: unknown, field: string): BaseUnits => {
	if (typeof value !== "string" || !digits.test(value)) {
		throw new MaschinaError("invalid_input", `the quote's ${field} is not a whole amount`, {
			details: { [field]: value },
		});
	}
	return baseUnitsOf(BigInt(value));
};

/** Price impact arrives as a percentage number ("0.12" means 0.12%), not a fraction. */
function priceImpactBps(value: unknown): number {
	if (value === undefined || value === null) return 0;
	const parsed = typeof value === "string" ? Number(value) : value;
	if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
		throw new MaschinaError("invalid_input", "the quote's price impact is not a number", {
			details: { priceImpact: value },
		});
	}
	return Math.ceil(parsed * 100);
}

function routeSteps(value: unknown): RouteStep[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new MaschinaError("invalid_input", "the quote has no route");
	}
	return value.map((entry) => {
		const step = asRecord(entry);
		const inputMint = step?.["inputMint"];
		const outputMint = step?.["outputMint"];
		if (typeof inputMint !== "string" || typeof outputMint !== "string") {
			throw new MaschinaError("invalid_input", "a step in the route is missing its tokens");
		}
		const pool = step?.["poolId"];
		return {
			label: typeof pool === "string" ? `raydium:${pool.slice(0, 8)}` : "raydium",
			inputMint: parseAddress(inputMint),
			outputMint: parseAddress(outputMint),
			percent: 100,
		};
	});
}

/** Pulls the useful part out of a Raydium answer, refusing one that says it failed. */
function dataOf(body: unknown): Record<string, unknown> {
	const answer = asRecord(body);
	if (!answer) throw new MaschinaError("invalid_input", "the router's answer is not a quote");
	if (answer["success"] !== true) {
		const message = answer["msg"] ?? answer["message"] ?? "the router refused";
		throw new MaschinaError("not_found", `raydium: ${String(message)}`);
	}
	const data = asRecord(answer["data"]);
	if (!data) throw new MaschinaError("invalid_input", "the router's answer has no quote in it");
	return data;
}

/** Reads a Raydium quote, holding it to the question that was asked. */
export function parseRaydiumQuote(request: QuoteRequest, body: unknown): SwapQuote {
	const data = dataOf(body);

	if (data["inputMint"] !== request.inputMint || data["outputMint"] !== request.outputMint) {
		throw new MaschinaError("invalid_input", "the quote is for different tokens", {
			details: {
				asked: { input: request.inputMint, output: request.outputMint },
				got: { input: data["inputMint"], output: data["outputMint"] },
			},
		});
	}

	const inputAmount = amount(data["inputAmount"], "input amount");
	if (inputAmount !== request.amount) {
		throw new MaschinaError("invalid_input", "the quote is for a different amount", {
			details: { asked: request.amount.toString(), got: inputAmount.toString() },
		});
	}

	const outputAmount = amount(data["outputAmount"], "output amount");
	const minimumOutputAmount = amount(data["otherAmountThreshold"], "minimum output amount");
	if (outputAmount === 0n) {
		throw new MaschinaError("not_found", "no route found: the quote produces nothing");
	}
	if (minimumOutputAmount > outputAmount) {
		throw new MaschinaError("invalid_input", "the quote's minimum is above its expected output", {
			details: {
				outputAmount: outputAmount.toString(),
				minimumOutputAmount: minimumOutputAmount.toString(),
			},
		});
	}

	const slippageBps = data["slippageBps"];
	if (typeof slippageBps !== "number" || !Number.isInteger(slippageBps) || slippageBps < 0) {
		throw new MaschinaError("invalid_input", "the quote's slippage is not a whole number");
	}
	if (slippageBps > request.slippageBps) {
		throw new MaschinaError("invalid_input", "the quote allows more slippage than was asked for", {
			details: { asked: request.slippageBps, got: slippageBps },
		});
	}

	return {
		router: "raydium",
		inputMint: request.inputMint,
		outputMint: request.outputMint,
		inputAmount,
		outputAmount,
		minimumOutputAmount,
		slippageBps,
		priceImpactBps: priceImpactBps(data["priceImpactPct"]),
		route: routeSteps(data["routePlan"]),
		raw: body,
	};
}

/** Refuses a request that should never reach a router. */
function checkRequest(request: QuoteRequest): void {
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

async function failureFor(response: Response): Promise<MaschinaError> {
	const text = await response.text().catch(() => "");
	const detail = text.slice(0, 500);

	if (response.status === 429) {
		return new MaschinaError("limit_exceeded", "rate limit from the router", {
			details: { detail },
		});
	}
	if (response.status === 401 || response.status === 403) {
		return new MaschinaError("forbidden", "the router refused our request", {
			details: { status: response.status },
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

/** A swap router backed by Raydium's trade API. */
export function raydiumRouter(options: RaydiumOptions = {}) {
	const baseUrl = (options.baseUrl ?? RAYDIUM_API).replace(/\/$/, "");
	const call = options.fetch ?? globalThis.fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const computePrice = options.computeUnitPriceMicroLamports ?? DEFAULT_COMPUTE_PRICE;

	const signalFor = (signal?: AbortSignal) => {
		const timeout = AbortSignal.timeout(timeoutMs);
		return signal ? AbortSignal.any([signal, timeout]) : timeout;
	};

	return {
		name: "raydium",

		async quote(request: QuoteRequest, signal?: AbortSignal): Promise<SwapQuote> {
			checkRequest(request);

			const url = new URL(`${baseUrl}/compute/swap-base-in`);
			url.searchParams.set("inputMint", request.inputMint);
			url.searchParams.set("outputMint", request.outputMint);
			url.searchParams.set("amount", request.amount.toString());
			url.searchParams.set("slippageBps", String(request.slippageBps));
			url.searchParams.set("txVersion", "V0");

			const response = await call(url, { signal: signalFor(signal) });
			if (!response.ok) throw await failureFor(response);

			return parseRaydiumQuote(request, await response.json());
		},

		async build(request: BuildSwapRequest, signal?: AbortSignal): Promise<UnsignedSwap> {
			if (!options.blockHeight) {
				throw new MaschinaError(
					"invalid_input",
					"raydium does not say when a transaction expires, so it needs a way to read the chain",
				);
			}

			const response = await call(new URL(`${baseUrl}/transaction/swap-base-in`), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					computeUnitPriceMicroLamports: computePrice.toString(),
					swapResponse: request.quote.raw,
					txVersion: "V0",
					wallet: request.wallet,
					wrapSol: true,
					unwrapSol: true,
				}),
				signal: signalFor(signal),
			});

			if (!response.ok) throw await failureFor(response);

			const body = await response.json();
			const answer = asRecord(body);
			if (answer?.["success"] !== true) {
				throw new MaschinaError("invalid_input", "the router did not build a transaction");
			}

			const transactions = answer["data"];
			if (!Array.isArray(transactions) || transactions.length !== 1) {
				// More than one transaction means the swap is not one act. A machine that half-finishes a
				// trade is worse than one that does not start it.
				throw new MaschinaError("invalid_input", "a swap must be a single transaction", {
					details: { returned: Array.isArray(transactions) ? transactions.length : 0 },
				});
			}

			const encoded = asRecord(transactions[0])?.["transaction"];
			const height = await options.blockHeight();

			return parseBuiltSwap(request, {
				swapTransaction: encoded,
				// Raydium does not say. A blockhash lasts 150 blocks from the one it was taken at, and this
				// one was taken a moment ago, so this is at or slightly past the real expiry. Erring late is
				// the safe direction: it delays calling a transaction dead, and never does so early.
				lastValidBlockHeight: (height + BLOCKHASH_LIFETIME_BLOCKS).toString(),
			});
		},
	};
}

export type RaydiumRouter = ReturnType<typeof raydiumRouter>;
