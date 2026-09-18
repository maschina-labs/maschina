import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import {
	checkQuoteRequest,
	JUPITER_API,
	JUPITER_LITE_API,
	jupiterRouter,
	parseJupiterQuote,
	quotedPrice,
} from "./jupiter.ts";
import type { QuoteRequest, SwapQuote } from "./router.ts";
import { unsignedTransactionBase64 } from "./testing.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDT = parseAddress("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

const request = (over: Partial<QuoteRequest> = {}): QuoteRequest => ({
	inputMint: SOL,
	outputMint: USDC,
	amount: 100_000_000n as QuoteRequest["amount"],
	slippageBps: 50,
	...over,
});

/** A Jupiter answer, shaped exactly as the live API returns one. */
const answer = (over: Record<string, unknown> = {}) => ({
	inputMint: SOL,
	inAmount: "100000000",
	outputMint: USDC,
	outAmount: "10587977",
	otherAmountThreshold: "10535038",
	swapMode: "ExactIn",
	slippageBps: 50,
	platformFee: null,
	priceImpactPct: "0.0012",
	routePlan: [
		{
			swapInfo: {
				ammKey: "9Vh6fqJjDkqSTZ8bDXseVxGb2yQEMkEhhtte2anQCHSf",
				label: "Whirlpool",
				inputMint: SOL,
				outputMint: USDC,
				inAmount: "100000000",
				outAmount: "10587977",
			},
			percent: 100,
		},
	],
	contextSlot: 448_024_099,
	...over,
});

describe("reading a quote", () => {
	it("takes the amounts, the floor and the route", () => {
		const quote = parseJupiterQuote(request(), answer());

		expect(quote.router).toBe("jupiter");
		expect(quote.inputAmount).toBe(100_000_000n);
		expect(quote.outputAmount).toBe(10_587_977n);
		expect(quote.minimumOutputAmount).toBe(10_535_038n);
		expect(quote.slippageBps).toBe(50);
		expect(quote.route).toEqual([
			{ label: "Whirlpool", inputMint: SOL, outputMint: USDC, percent: 100 },
		]);
	});

	it("keeps the router's own answer, so the trade is built from this exact quote", () => {
		const body = answer();
		expect(parseJupiterQuote(request(), body).raw).toBe(body);
	});

	it("rounds price impact up, never reporting a trade as gentler than it is", () => {
		expect(parseJupiterQuote(request(), answer({ priceImpactPct: "0.0012" })).priceImpactBps).toBe(
			12,
		);
		expect(parseJupiterQuote(request(), answer({ priceImpactPct: "0.00001" })).priceImpactBps).toBe(
			1,
		);
		expect(parseJupiterQuote(request(), answer({ priceImpactPct: "0" })).priceImpactBps).toBe(0);
		expect(parseJupiterQuote(request(), answer({ priceImpactPct: 0.05 })).priceImpactBps).toBe(500);
		expect(parseJupiterQuote(request(), answer({ priceImpactPct: null })).priceImpactBps).toBe(0);
	});

	it("refuses a quote for different tokens than the ones asked about", () => {
		expect(() => parseJupiterQuote(request(), answer({ outputMint: USDT }))).toThrow(
			/different tokens/,
		);
	});

	it("refuses a quote for a different amount", () => {
		expect(() => parseJupiterQuote(request(), answer({ inAmount: "99000000" }))).toThrow(
			/different amount/,
		);
	});

	it("refuses a quote that allows more slippage than was asked for", () => {
		expect(() => parseJupiterQuote(request(), answer({ slippageBps: 300 }))).toThrow(
			/more slippage/,
		);
	});

	it("accepts a quote with tighter slippage than was asked for", () => {
		expect(parseJupiterQuote(request(), answer({ slippageBps: 10 })).slippageBps).toBe(10);
	});

	it("refuses a quote whose floor is above what it expects to produce", () => {
		expect(() =>
			parseJupiterQuote(request(), answer({ otherAmountThreshold: "99999999" })),
		).toThrow(/minimum is above/);
	});

	it("refuses a quote that produces nothing", () => {
		expect(() =>
			parseJupiterQuote(request(), answer({ outAmount: "0", otherAmountThreshold: "0" })),
		).toThrow(/no route/);
	});

	it.each([
		["an answer that is not an object", "nope"],
		["a missing input amount", { inAmount: undefined }],
		["an amount that is not whole", { outAmount: "1.5" }],
		["an amount held as a number", { outAmount: 10 }],
		["a swap mode we do not support", { swapMode: "ExactOut" }],
		["slippage that is not a number", { slippageBps: "50" }],
		["negative slippage", { slippageBps: -1 }],
		["price impact that is not a number", { priceImpactPct: "sideways" }],
		["price impact that is an object", { priceImpactPct: {} }],
		["no route at all", { routePlan: [] }],
		["a route that is not a list", { routePlan: "direct" }],
		[
			"a route step missing its tokens",
			{ routePlan: [{ swapInfo: { label: "X" }, percent: 100 }] },
		],
	])("refuses %s", (_name, over) => {
		const body = typeof over === "string" ? over : answer(over as Record<string, unknown>);
		expect(() => parseJupiterQuote(request(), body)).toThrow(MaschinaError);
	});

	it("fills in what a router leaves out, rather than failing on it", () => {
		const quote = parseJupiterQuote(
			request(),
			answer({
				swapMode: undefined,
				routePlan: [{ swapInfo: { inputMint: SOL, outputMint: USDC }, percent: undefined }],
			}),
		);

		expect(quote.route[0]).toEqual({
			label: "unknown",
			inputMint: SOL,
			outputMint: USDC,
			percent: 100,
		});
	});
});

describe("refusing a request before it reaches a router", () => {
	it.each([
		["the same token twice", { outputMint: SOL }],
		["nothing to spend", { amount: 0n as QuoteRequest["amount"] }],
		["slippage past what anyone should accept", { slippageBps: 1001 }],
		["slippage that is not whole", { slippageBps: 12.5 }],
		["negative slippage", { slippageBps: -1 }],
	])("refuses %s", (_name, over) => {
		expect(() => checkQuoteRequest(request(over))).toThrow(MaschinaError);
	});

	it("allows a normal request", () => {
		expect(() => checkQuoteRequest(request())).not.toThrow();
	});
});

/** A router whose HTTP layer answers however the test says. */
const routerWith = (
	responder: (url: URL, init: RequestInit) => Response | Promise<Response>,
	options: Parameters<typeof jupiterRouter>[0] = {},
) =>
	jupiterRouter({
		...options,
		fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
			Promise.resolve(responder(input as URL, init ?? {}))) as typeof fetch,
	});

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
		...init,
	});

describe("asking Jupiter for a quote", () => {
	it("asks for exactly what the machine wants", async () => {
		let asked: URL | undefined;
		const router = routerWith((url) => {
			asked = url;
			return json(answer());
		});

		const quote = await router.quote(request());

		expect(asked?.pathname).toBe("/swap/v1/quote");
		expect(asked?.searchParams.get("inputMint")).toBe(SOL);
		expect(asked?.searchParams.get("amount")).toBe("100000000");
		expect(asked?.searchParams.get("slippageBps")).toBe("50");
		expect(asked?.searchParams.get("restrictIntermediateTokens")).toBe("true");
		expect(quote.outputAmount).toBe(10_587_977n);
	});

	it("uses the keyless endpoint without a key, and the paid one with it", async () => {
		expect(jupiterRouter().name).toBe("jupiter");

		let keyless: URL | undefined;
		await routerWith((url) => {
			keyless = url;
			return json(answer());
		}).quote(request());
		expect(keyless?.origin).toBe(JUPITER_LITE_API);

		let withKey: URL | undefined;
		let headers: unknown;
		await routerWith(
			(url, init) => {
				withKey = url;
				headers = init.headers;
				return json(answer());
			},
			{ apiKey: "a-key" },
		).quote(request());
		expect(withKey?.origin).toBe(JUPITER_API);
		expect(headers).toEqual({ "x-api-key": "a-key" });
	});

	it("uses a configured endpoint when there is one", async () => {
		let asked: URL | undefined;
		await routerWith(
			(url) => {
				asked = url;
				return json(answer());
			},
			{ baseUrl: "https://quotes.example/" },
		).quote(request());

		expect(asked?.origin).toBe("https://quotes.example");
	});

	it("calls a rate limit a limit, so the run waits instead of hammering", async () => {
		const router = routerWith(
			() => new Response("slow down", { status: 429, headers: { "retry-after": "30" } }),
		);

		await expect(router.quote(request())).rejects.toMatchObject({
			code: "limit_exceeded",
			message: expect.stringContaining("retry after 30"),
		});
	});

	it("calls a refused key forbidden, which no retry will fix", async () => {
		const router = routerWith(() => new Response("nope", { status: 401 }));

		await expect(router.quote(request())).rejects.toMatchObject({ code: "forbidden" });
	});

	it("calls a missing route not found, which trying again will not fix", async () => {
		const router = routerWith(
			() => new Response(JSON.stringify({ error: "No route found" }), { status: 400 }),
		);

		await expect(router.quote(request())).rejects.toMatchObject({ code: "not_found" });
	});

	it("calls a broken router unavailable, which is worth trying again", async () => {
		const router = routerWith(() => new Response("bad gateway", { status: 502 }));

		await expect(router.quote(request())).rejects.toMatchObject({ code: "unavailable" });
	});

	it("calls a rejected request invalid, and keeps what the router said", async () => {
		const router = routerWith(() => new Response("amount too small", { status: 400 }));

		await expect(router.quote(request())).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("never asks about an impossible request", async () => {
		let asked = false;
		const router = routerWith(() => {
			asked = true;
			return json(answer());
		});

		await expect(router.quote(request({ outputMint: SOL }))).rejects.toThrow(MaschinaError);
		expect(asked).toBe(false);
	});

	it("gives up on a quote that takes too long, because a stale price is worthless", async () => {
		const router = jupiterRouter({
			timeoutMs: 5,
			fetch: ((_url: URL, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener("abort", () => reject(new Error("timed out")));
				})) as typeof fetch,
		});

		await expect(router.quote(request())).rejects.toThrow(/timed out/);
	});

	it("stops when the caller stops, not only when the clock runs out", async () => {
		const caller = new AbortController();
		const router = jupiterRouter({
			fetch: ((_url: URL, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener("abort", () => reject(new Error("caller stopped")));
					caller.abort();
				})) as typeof fetch,
		});

		await expect(router.quote(request(), caller.signal)).rejects.toThrow(/caller stopped/);
	});
});

describe("a price from a quote", () => {
	it("is the output for one whole input token, with no floating point", () => {
		const quote = parseJupiterQuote(request(), answer());

		// 0.1 SOL bought 10.587977 USDC, so one SOL is about 105.87 USDC.
		expect(quotedPrice(quote, 9)).toBe(105_879_770n);
	});
});

describe("asking Jupiter to build the transaction", () => {
	const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");

	const buildAnswer = (over: Record<string, unknown> = {}) => ({
		swapTransaction: unsignedTransactionBase64(WALLET),
		lastValidBlockHeight: 426_070_577,
		prioritizationFeeLamports: 6417,
		computeUnitLimit: 1_400_000,
		...over,
	});

	const quoteFor = (): SwapQuote => parseJupiterQuote(request(), answer());

	it("sends the quote back exactly as it arrived", async () => {
		let sent: RequestInit | undefined;
		let asked: URL | undefined;
		const router = routerWith((url, init) => {
			asked = url;
			sent = init;
			return json(buildAnswer());
		});
		const quote = quoteFor();

		const swap = await router.build({ quote, wallet: WALLET });

		expect(asked?.pathname).toBe("/swap/v1/swap");
		expect(sent?.method).toBe("POST");
		const body = JSON.parse(String(sent?.body));
		// The exact answer Jupiter gave, not a rebuilt copy of it.
		expect(body.quoteResponse).toEqual(quote.raw);
		expect(body.userPublicKey).toBe(WALLET);
		expect(body.wrapAndUnwrapSol).toBe(true);
		expect(swap.wallet).toBe(WALLET);
		expect(swap.facts.feePayer).toBe(WALLET);
	});

	it("sends the key when there is one", async () => {
		let headers: Record<string, string> | undefined;
		const router = routerWith(
			(_url, init) => {
				headers = init.headers as Record<string, string>;
				return json(buildAnswer());
			},
			{ apiKey: "a-key" },
		);

		await router.build({ quote: quoteFor(), wallet: WALLET });

		expect(headers?.["x-api-key"]).toBe("a-key");
		expect(headers?.["content-type"]).toBe("application/json");
	});

	it("turns a refusal into a code the run loop understands", async () => {
		const limited = routerWith(() => new Response("slow down", { status: 429 }));
		const broken = routerWith(() => new Response("down", { status: 503 }));

		await expect(limited.build({ quote: quoteFor(), wallet: WALLET })).rejects.toMatchObject({
			code: "limit_exceeded",
		});
		await expect(broken.build({ quote: quoteFor(), wallet: WALLET })).rejects.toMatchObject({
			code: "unavailable",
		});
	});

	it("refuses a transaction built for somebody else's wallet", async () => {
		const router = routerWith(() =>
			json(
				buildAnswer({
					swapTransaction: unsignedTransactionBase64(WALLET, {
						feePayer: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
					}),
				}),
			),
		);

		await expect(router.build({ quote: quoteFor(), wallet: WALLET })).rejects.toThrow(
			/different wallet to sign/,
		);
	});
});
