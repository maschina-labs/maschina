import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { parseAddress } from "./address.ts";
import type { MintDetails } from "./mint.ts";
import type { SwapQuote } from "./router.ts";
import { jupiterTokenInfo, parseTokenInfo, readTokenFacts, type TokenInfo } from "./token-facts.ts";

const BONK = parseAddress("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const NOW = new Date("2026-10-02T12:00:00Z");

/** Jupiter's own answer for BONK, trimmed to the fields read. */
const info = {
	id: BONK,
	holderCount: 1_026_155,
	liquidity: 5_220_118.2,
	firstPool: { createdAt: "2023-05-11T17:09:10Z" },
	audit: {
		mintAuthorityDisabled: true,
		freezeAuthorityDisabled: true,
		topHoldersPercentage: 30.45,
	},
};

const mint = (change: Partial<MintDetails> = {}): MintDetails => ({
	mint: BONK,
	program: "token",
	decimals: 5,
	supply: 88_000_000_000_000_000n,
	extensions: [],
	...change,
});

const quote = (inputMint: string, outputAmount: bigint, impactBps: number) =>
	({
		router: "jupiter",
		inputMint,
		outputMint: inputMint === USDC ? BONK : USDC,
		inputAmount: 20_000_000n,
		outputAmount,
		minimumOutputAmount: outputAmount,
		slippageBps: 50,
		priceImpactBps: impactBps,
		route: [],
	}) as unknown as SwapQuote;

function setup(
	over: { mint?: Partial<MintDetails>; sell?: () => Promise<SwapQuote>; info?: unknown } = {},
) {
	return {
		mint: BONK,
		usdc: USDC,
		sizeUsdc: baseUnitsOf(20_000_000n),
		now: NOW,
		mints: vi.fn(async (_mint: string) => mint(over.mint)),
		info: vi.fn(async (_mint: string) =>
			over.info === undefined ? parseTokenInfo([info], BONK) : (over.info as TokenInfo | undefined),
		),
		router: {
			quote: vi.fn(async (request: { inputMint: string }) =>
				request.inputMint === USDC
					? quote(USDC, 549_900_000_000n, 12)
					: over.sell
						? over.sell()
						: quote(BONK, 19_960_000n, 18),
			),
		},
	};
}

describe("reading a token's facts", () => {
	it("reads authorities from the chain, the rest from Jupiter, and both quotes", async () => {
		const facts = await readTokenFacts(setup());
		expect(facts).toEqual({
			mint: BONK,
			mintAuthority: null,
			freezeAuthority: null,
			topHoldersShare: 0.3045,
			holders: 1_026_155,
			liquidityUsd: 5_220_118.2,
			ageHours: expect.closeTo(24 * 1239.7, -1),
			buyImpactPct: 0.12,
			sellImpactPct: 0.18,
			sellRoute: true,
		});
	});

	it("trusts the chain over Jupiter for who can mint or freeze", async () => {
		const facts = await readTokenFacts(
			setup({
				mint: { mintAuthority: parseAddress("8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR") },
			}),
		);
		expect(facts.mintAuthority).toBe("8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR");
	});

	it("calls it unsellable when no route back exists", async () => {
		const facts = await readTokenFacts(
			setup({
				sell: async () => {
					throw new Error("no route");
				},
			}),
		);
		expect(facts.sellRoute).toBe(false);
		expect(facts.sellImpactPct).toBeUndefined();
	});

	it("leaves anything it could not read unknown, rather than guessing", async () => {
		const failing = setup();
		failing.info = vi.fn(async (_mint: string): Promise<TokenInfo | undefined> => {
			throw new Error("Jupiter is down");
		});
		const facts = await readTokenFacts(failing);
		expect(facts.holders).toBeUndefined();
		expect(facts.liquidityUsd).toBeUndefined();
		expect(facts.ageHours).toBeUndefined();
		// The chain still answered, so those facts are still known.
		expect(facts.mintAuthority).toBeNull();
	});
});

describe("Jupiter's token answer", () => {
	it("reads the figures it carries, and nothing it does not", () => {
		expect(parseTokenInfo([info], BONK)).toMatchObject({
			holders: 1_026_155,
			topHoldersShare: 0.3045,
		});
		expect(parseTokenInfo([], BONK)).toBeUndefined();
		expect(parseTokenInfo([{ id: "someone else" }], BONK)).toBeUndefined();
		expect(parseTokenInfo([{ id: BONK, holderCount: "lots" }], BONK)?.holders).toBeUndefined();
	});
});

describe("asking Jupiter's token list", () => {
	it("searches by mint, with the key when there is one", async () => {
		const fetch = vi.fn(
			async (_url: string | URL | Request, _init?: RequestInit) =>
				new Response(JSON.stringify([info])),
		);
		const read = jupiterTokenInfo({ baseUrl: "https://example.test/", apiKey: "k", fetch });
		expect((await read(BONK))?.holders).toBe(1_026_155);
		const [url, init] = fetch.mock.calls[0] ?? [];
		expect(String(url)).toBe(`https://example.test/tokens/v2/search?query=${BONK}`);
		expect(init?.headers).toEqual({ "x-api-key": "k" });
	});

	it("goes without a key on the free endpoint", async () => {
		const fetch = vi.fn(
			async (_url: string | URL | Request, _init?: RequestInit) => new Response("[]"),
		);
		expect(await jupiterTokenInfo({ fetch })(BONK)).toBeUndefined();
		expect(String(fetch.mock.calls[0]?.[0])).toContain("https://lite-api.jup.ag/tokens/v2/search");
		expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({});
	});

	it("fails loudly on an error answer, so the fact is left unknown", async () => {
		const fetch = vi.fn(async () => new Response("busy", { status: 429 }));
		await expect(jupiterTokenInfo({ fetch })(BONK)).rejects.toThrow("answered 429");
	});

	it("reads a token with no audit or pool as unknown on those", () => {
		expect(parseTokenInfo({ not: "a list" }, BONK)).toBeUndefined();
		expect(parseTokenInfo([{ id: BONK, firstPool: { createdAt: "never" } }], BONK)).toEqual({
			holders: undefined,
			liquidityUsd: undefined,
			topHoldersShare: undefined,
			firstPoolAt: undefined,
		});
	});

	it("never asks about selling when buying could not be quoted", async () => {
		const blind = setup();
		blind.router.quote = vi.fn(async () => {
			throw new Error("no route");
		});
		const facts = await readTokenFacts(blind);
		expect(facts.sellRoute).toBeUndefined();
		expect(facts.buyImpactPct).toBeUndefined();
	});
});
