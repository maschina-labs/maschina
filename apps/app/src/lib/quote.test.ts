import { describe, expect, it, vi } from "vitest";
import { fetchQuote, readQuote, TOKENS } from "./quote.ts";

const body = {
	outAmount: "84536739",
	otherAmountThreshold: "84114056",
	priceImpactPct: "0.0012",
	routePlan: [{ swapInfo: { label: "Deriverse" } }, { swapInfo: { label: "GoonFi V2" } }],
};

describe("a swap quote", () => {
	it("reads what arrives, the least that can, the impact and the route", () => {
		expect(readQuote(body, "SOL")).toEqual({
			out: 0.084536739,
			atLeast: 0.084114056,
			impactPct: 0.12,
			route: ["Deriverse", "GoonFi V2"],
		});
	});

	it("gives nothing for an answer with no amount", () => {
		expect(readQuote({}, "SOL")).toBeUndefined();
		expect(readQuote(null, "SOL")).toBeUndefined();
	});

	it("asks Jupiter for the exact amount in base units", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify(body)));
		await fetchQuote("USDC", "SOL", 10, 50, fetcher as never);

		expect(fetcher).toHaveBeenCalledWith(
			`https://lite-api.jup.ag/swap/v1/quote?inputMint=${TOKENS.USDC.mint}&outputMint=${TOKENS.SOL.mint}&amount=10000000&slippageBps=50`,
		);
	});

	it("says so when there is no route", async () => {
		const empty = vi.fn(async () => new Response("{}"));
		await expect(fetchQuote("USDC", "SOL", 10, 50, empty as never)).rejects.toThrow(/no route/);
	});
});
