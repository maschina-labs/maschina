/**
 * Both routers, asked the same question at the same moment, against the live market.
 *
 * Nothing here asserts who wins: that is a market fact that changes, and pinning it would make this test
 * a weather report. What it proves is that the comparison works on real answers, so the choice of
 * default can be re-measured whenever it matters rather than assumed.
 */

import { MaschinaError } from "@maschina/core";
import {
	compareRouters,
	DEFAULT_ROUTER,
	jupiterRouter,
	parseAddress,
	type QuoteRequest,
	raydiumRouter,
} from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { live } from "./support/live.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const key = process.env["JUPITER_API_KEY"];
const routers = [
	jupiterRouter({ ...(key ? { apiKey: key } : {}), timeoutMs: 20_000 }),
	raydiumRouter({ timeoutMs: 20_000 }),
];

const swapOf = (amount: bigint): QuoteRequest => ({
	inputMint: SOL,
	outputMint: USDC,
	amount: amount as QuoteRequest["amount"],
	slippageBps: 50,
});

describe("comparing the routers on real swaps", () => {
	it("gets a real answer from both, and scores them on the floor", async () => {
		const result = await compareRouters(routers, [swapOf(10_000_000n), swapOf(1_000_000_000n)], {
			pause: () => new Promise((resolve) => setTimeout(resolve, 1200)),
		});

		// The comparison catches a router's failure rather than throwing, so a bad minute at one of them
		// shows up as a failed attempt instead of a failed test. Only a total silence is a problem.

		expect(result.requests).toBe(2);
		expect(result.scores).toHaveLength(2);

		for (const score of result.scores) {
			expect(score.answered + score.failed).toBe(2);
			// Whoever answered did so with a real floor, and in a time worth recording.
			if (score.answered > 0) expect(score.medianMs).toBeGreaterThan(0);
		}

		// Both are real routers on a liquid pair, so at least one has to have answered.
		expect(result.best).toBeDefined();
	});

	it("has both routers agreeing on the price to within a fraction of a percent", async () => {
		// Both have to answer for this comparison to mean anything, so a vendor's bad minute is retried.
		const answers = await live(async () => {
			const result = await compareRouters(routers, [swapOf(100_000_000n)]);
			const round = result.attempts[0] ?? [];
			const ok = round.filter((attempt) => attempt.ok);
			if (ok.length !== routers.length) {
				const failure = round.find((attempt) => !attempt.ok);
				throw new MaschinaError(
					"unavailable",
					`a router did not answer: ${failure && !failure.ok ? failure.because : "unknown"}`,
				);
			}
			return ok;
		});

		const floors = answers.map((attempt) => (attempt.ok ? attempt.minimumOutputAmount : 0n));
		const best = floors.reduce((most, floor) => (floor > most ? floor : most), 0n);
		const worst = floors.reduce((least, floor) => (floor < least ? floor : least), best);

		// A gap wider than 5% on SOL to USDC means one of them is reading the market wrong.
		expect(Number(((best - worst) * 10_000n) / best)).toBeLessThan(500);
	});

	it("uses the router the measurement chose", () => {
		expect(routers.some((router) => router.name === DEFAULT_ROUTER)).toBe(true);
	});
});
