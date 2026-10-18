import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { checkQuote } from "./quote.ts";

/** A quote that breaks nothing: 1% slippage allowed, a floor that matches it, a deep market. */
const quote = (over: Partial<Parameters<typeof checkQuote>[0]> = {}) => ({
	quotedOutputAmount: baseUnitsOf(1_000_000n),
	minimumOutputAmount: baseUnitsOf(995_000n),
	slippageBps: 50,
	priceImpactBps: 3,
	maxSlippageBps: 300,
	maxPriceImpactBps: 300,
	...over,
});

describe("judging the quote before anything is simulated", () => {
	it("allows a quote inside every cap", () => {
		expect(checkQuote(quote())).toEqual({ allowed: true });
	});

	it("refuses slippage wider than the owner allowed, and pauses", () => {
		// The owner's number, not the node's. A node asking for more has been told no.
		const decision = checkQuote(quote({ slippageBps: 301, minimumOutputAmount: baseUnitsOf(1n) }));

		expect(decision.allowed).toBe(false);
		expect(!decision.allowed && decision.rule).toBe("slippage_cap");
		expect(!decision.allowed && decision.pause).toBe("other");
	});

	it("allows slippage exactly at the cap, because a cap is inclusive", () => {
		expect(
			checkQuote(quote({ slippageBps: 300, minimumOutputAmount: baseUnitsOf(970_000n) })),
		).toEqual({
			allowed: true,
		});
	});

	it("refuses a floor looser than the slippage the quote itself claims, and pauses", () => {
		// 50 bps of 1,000,000 is a floor of 995,000. Anything under that is the proposal
		// contradicting its own stated slippage, and nothing honest does that.
		const decision = checkQuote(quote({ minimumOutputAmount: baseUnitsOf(994_999n) }));

		expect(decision.allowed).toBe(false);
		expect(!decision.allowed && decision.rule).toBe("minimum_output");
		expect(!decision.allowed && decision.pause).toBe("other");
	});

	it("refuses a floor of nothing, which is not a floor", () => {
		// The hole this closes: `judgeSwap` holds the trade to `minimumOutputAmount`, so a node that
		// sets it to zero makes that check pass whatever comes back.
		const decision = checkQuote(quote({ minimumOutputAmount: baseUnitsOf(0n) }));

		expect(!decision.allowed && decision.rule).toBe("minimum_output");
	});

	it("refuses a quote that promises nothing", () => {
		const decision = checkQuote(
			quote({ quotedOutputAmount: baseUnitsOf(0n), minimumOutputAmount: baseUnitsOf(0n) }),
		);

		expect(!decision.allowed && decision.rule).toBe("minimum_output");
	});

	it("allows a floor tighter than the slippage requires", () => {
		// Asking for less than you are entitled to is never a problem.
		expect(checkQuote(quote({ minimumOutputAmount: baseUnitsOf(999_000n) }))).toEqual({
			allowed: true,
		});
	});

	it("refuses price impact beyond the cap, without pausing", () => {
		// A thin market is the market, not a fault. The trade waits; the machine carries on.
		const decision = checkQuote(quote({ priceImpactBps: 301 }));

		expect(decision.allowed).toBe(false);
		expect(!decision.allowed && decision.rule).toBe("price_impact");
		expect(!decision.allowed && decision.pause).toBeUndefined();
	});

	it("refuses price impact that is not a number, because unknown is not small", () => {
		const decision = checkQuote(quote({ priceImpactBps: Number.NaN }));

		expect(!decision.allowed && decision.rule).toBe("price_impact");
	});

	it("checks the owner's cap before the proposal's own arithmetic", () => {
		// Both are broken. The owner's limit is the more fundamental answer, so it wins.
		const decision = checkQuote(quote({ slippageBps: 900, minimumOutputAmount: baseUnitsOf(1n) }));

		expect(!decision.allowed && decision.rule).toBe("slippage_cap");
	});
});
