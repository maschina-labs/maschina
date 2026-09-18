import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { BLOCKHASH_LIFETIME_BLOCKS, parseRaydiumQuote, raydiumRouter } from "./raydium.ts";
import type { QuoteRequest, SwapQuote } from "./router.ts";
import { unsignedTransactionBase64 } from "./testing.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDT = parseAddress("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const RAYDIUM_PROGRAM = "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS";

const request = (over: Partial<QuoteRequest> = {}): QuoteRequest => ({
	inputMint: SOL,
	outputMint: USDC,
	amount: 100_000_000n as QuoteRequest["amount"],
	slippageBps: 50,
	...over,
});

/** A Raydium answer, shaped exactly as the live API returns one. */
const answer = (over: Record<string, unknown> = {}, success = true) => ({
	id: "c5c4f1c6-78a9-4301-8403-41d064b8c2b2",
	success,
	version: "V1",
	data: {
		swapType: "BaseIn",
		inputMint: SOL,
		inputAmount: "100000000",
		outputMint: USDC,
		outputAmount: "10570432",
		otherAmountThreshold: "10517579",
		slippageBps: 50,
		priceImpactPct: 0.12,
		routePlan: [
			{
				poolId: "CYbD9RaToYMtWKA7QZyoLahnHdWq553Vm62Lh6qWtuxq",
				inputMint: SOL,
				outputMint: USDC,
				feeMint: SOL,
				feeRate: 2,
				feeAmount: "20000",
			},
		],
		...over,
	},
});

describe("reading a Raydium quote", () => {
	it("takes the amounts, the floor and the pool it routes through", () => {
		const quote = parseRaydiumQuote(request(), answer());

		expect(quote.router).toBe("raydium");
		expect(quote.inputAmount).toBe(100_000_000n);
		expect(quote.outputAmount).toBe(10_570_432n);
		expect(quote.minimumOutputAmount).toBe(10_517_579n);
		expect(quote.route[0]?.label).toBe("raydium:CYbD9RaT");
	});

	it("reads price impact as a percentage, not a fraction", () => {
		// Raydium says 0.12 and means 0.12%, where Jupiter says 0.0012 and means the same thing.
		expect(parseRaydiumQuote(request(), answer({ priceImpactPct: 0.12 })).priceImpactBps).toBe(12);
		expect(parseRaydiumQuote(request(), answer({ priceImpactPct: 0 })).priceImpactBps).toBe(0);
		expect(parseRaydiumQuote(request(), answer({ priceImpactPct: "1.5" })).priceImpactBps).toBe(
			150,
		);
	});

	it("refuses an answer that says it failed", () => {
		expect(() => parseRaydiumQuote(request(), { success: false, msg: "no pool" })).toThrow(
			/raydium: no pool/,
		);
	});

	it("refuses a quote for different tokens or a different amount", () => {
		expect(() => parseRaydiumQuote(request(), answer({ outputMint: USDT }))).toThrow(
			/different tokens/,
		);
		expect(() => parseRaydiumQuote(request(), answer({ inputAmount: "1" }))).toThrow(
			/different amount/,
		);
	});

	it("refuses a quote that allows more slippage than was asked for", () => {
		expect(() => parseRaydiumQuote(request(), answer({ slippageBps: 500 }))).toThrow(
			/more slippage/,
		);
	});

	it("refuses a quote whose floor is above its own expectation", () => {
		expect(() =>
			parseRaydiumQuote(request(), answer({ otherAmountThreshold: "99999999" })),
		).toThrow(/minimum is above/);
	});

	it.each([
		["an answer that is not an object", "nope"],
		["an answer with no quote in it", { success: true }],
		["an amount that is not whole", { outputAmount: "1.5" }],
		["a quote that produces nothing", { outputAmount: "0", otherAmountThreshold: "0" }],
		["slippage that is not a number", { slippageBps: "50" }],
		["price impact that is nonsense", { priceImpactPct: "sideways" }],
		["no route at all", { routePlan: [] }],
		["a route step missing its tokens", { routePlan: [{ poolId: "x" }] }],
	])("refuses %s", (_name, over) => {
		const body =
			typeof over === "string"
				? over
				: "success" in (over as object)
					? over
					: answer(over as Record<string, unknown>);
		expect(() => parseRaydiumQuote(request(), body)).toThrow(MaschinaError);
	});
});

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
		...init,
	});

const routerWith = (
	responder: (url: URL, init: RequestInit) => Response,
	options: Parameters<typeof raydiumRouter>[0] = {},
) =>
	raydiumRouter({
		...options,
		fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
			Promise.resolve(responder(input as URL, init ?? {}))) as typeof fetch,
	});

describe("asking Raydium", () => {
	it("asks for a version 0 transaction and the amounts requested", async () => {
		let asked: URL | undefined;
		const router = routerWith((url) => {
			asked = url;
			return json(answer());
		});

		const quote = await router.quote(request());

		expect(asked?.pathname).toBe("/compute/swap-base-in");
		expect(asked?.searchParams.get("txVersion")).toBe("V0");
		expect(asked?.searchParams.get("amount")).toBe("100000000");
		expect(quote.outputAmount).toBe(10_570_432n);
		expect(router.name).toBe("raydium");
	});

	it("refuses an impossible request before asking anyone", async () => {
		let asked = false;
		const router = routerWith(() => {
			asked = true;
			return json(answer());
		});

		await expect(router.quote(request({ outputMint: SOL }))).rejects.toThrow(MaschinaError);
		await expect(router.quote(request({ slippageBps: 5000 }))).rejects.toThrow(MaschinaError);
		expect(asked).toBe(false);
	});

	it("turns refusals into codes the run loop understands", async () => {
		const limited = routerWith(() => new Response("slow down", { status: 429 }));
		const broken = routerWith(() => new Response("down", { status: 502 }));
		const refused = routerWith(() => new Response("no", { status: 403 }));

		await expect(limited.quote(request())).rejects.toMatchObject({ code: "limit_exceeded" });
		await expect(broken.quote(request())).rejects.toMatchObject({ code: "unavailable" });
		await expect(refused.quote(request())).rejects.toMatchObject({ code: "forbidden" });
	});
});

describe("building a Raydium transaction", () => {
	const quote = (): SwapQuote => parseRaydiumQuote(request(), answer());

	const buildAnswer = (over: Record<string, unknown> = {}) => ({
		id: "2b4c5133-tx",
		version: "V1",
		success: true,
		data: [{ transaction: unsignedTransactionBase64(WALLET, { programs: [RAYDIUM_PROGRAM] }) }],
		...over,
	});

	it("refuses to build without a way to know when the transaction expires", async () => {
		const router = routerWith(() => json(buildAnswer()));

		await expect(router.build({ quote: quote(), wallet: WALLET })).rejects.toThrow(
			/needs a way to read the chain/,
		);
	});

	it("works out the expiry from the chain's height", async () => {
		const router = routerWith(() => json(buildAnswer()), {
			blockHeight: async () => 1000n,
		});

		const swap = await router.build({ quote: quote(), wallet: WALLET });

		expect(swap.lastValidBlockHeight).toBe(1000n + BLOCKHASH_LIFETIME_BLOCKS);
		expect(swap.facts.feePayer).toBe(WALLET);
		expect(swap.router).toBe("raydium");
		// Raydium says neither of these, so neither is claimed.
		expect(swap.priorityFeeLamports).toBeUndefined();
		expect(swap.computeUnitLimit).toBeUndefined();
	});

	it("sends the quote back exactly as it arrived", async () => {
		let sent: RequestInit | undefined;
		const router = routerWith(
			(_url, init) => {
				sent = init;
				return json(buildAnswer());
			},
			{ blockHeight: async () => 1n },
		);
		const original = quote();

		await router.build({ quote: original, wallet: WALLET });

		expect(JSON.parse(String(sent?.body)).swapResponse).toEqual(original.raw);
		expect(JSON.parse(String(sent?.body)).wallet).toBe(WALLET);
	});

	it("refuses a swap that arrives as more than one transaction", async () => {
		const router = routerWith(
			() =>
				json(
					buildAnswer({
						data: [
							{ transaction: unsignedTransactionBase64(WALLET) },
							{ transaction: unsignedTransactionBase64(WALLET) },
						],
					}),
				),
			{ blockHeight: async () => 1n },
		);

		await expect(router.build({ quote: quote(), wallet: WALLET })).rejects.toThrow(
			/single transaction/,
		);
	});

	it("refuses an answer that says it did not build anything", async () => {
		const router = routerWith(() => json({ success: false, msg: "nope" }), {
			blockHeight: async () => 1n,
		});

		await expect(router.build({ quote: quote(), wallet: WALLET })).rejects.toThrow(
			/did not build a transaction/,
		);
	});
});
