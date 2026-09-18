import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { bestRouter, compareRouters, type QuoteAttempt, scoreRouters } from "./compare-routers.ts";
import type { QuoteRequest, SwapQuote, SwapRouter } from "./router.ts";

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const request = (amount: bigint): QuoteRequest => ({
	inputMint: SOL,
	outputMint: USDC,
	amount: amount as QuoteRequest["amount"],
	slippageBps: 50,
});

const quote = (output: bigint, minimum: bigint): SwapQuote => ({
	router: "test",
	inputMint: SOL,
	outputMint: USDC,
	inputAmount: 100_000_000n as SwapQuote["inputAmount"],
	outputAmount: output as SwapQuote["outputAmount"],
	minimumOutputAmount: minimum as SwapQuote["minimumOutputAmount"],
	slippageBps: 50,
	priceImpactBps: 0,
	route: [],
	raw: {},
});

/** A router that answers with scripted quotes, taking a scripted amount of time. */
function fakeRouter(
	name: string,
	answers: ({ output: bigint; minimum: bigint; ms: number } | { fails: string; ms: number })[],
	clock: { now: number },
): SwapRouter {
	let call = 0;
	return {
		name,
		async quote() {
			const answer = answers[Math.min(call, answers.length - 1)];
			call += 1;
			if (!answer) throw new Error("no answer");
			clock.now += answer.ms;
			if ("fails" in answer) throw new Error(answer.fails);
			return quote(answer.output, answer.minimum);
		},
		async build() {
			throw new Error("not needed for a comparison");
		},
	};
}

describe("comparing routers", () => {
	it("asks every router the same questions and records both answers", async () => {
		const clock = { now: 0 };
		const fast = fakeRouter("fast", [{ output: 100n, minimum: 99n, ms: 10 }], clock);
		const slow = fakeRouter("slow", [{ output: 120n, minimum: 118n, ms: 200 }], clock);

		const result = await compareRouters([fast, slow], [request(1n)], { now: () => clock.now });

		expect(result.requests).toBe(1);
		expect(result.attempts[0]).toHaveLength(2);
		expect(result.scores.map((score) => score.router)).toEqual(["fast", "slow"]);
	});

	it("judges the floor, not the hoped-for amount", () => {
		const attempts: QuoteAttempt[][] = [
			[
				// Promises more, guarantees less. That is optimism, and it loses.
				{ router: "optimist", ok: true, tookMs: 10, outputAmount: 200n, minimumOutputAmount: 90n },
				{ router: "honest", ok: true, tookMs: 10, outputAmount: 110n, minimumOutputAmount: 100n },
			],
		];

		const scores = scoreRouters(
			[{ name: "optimist" } as SwapRouter, { name: "honest" } as SwapRouter],
			attempts,
		);

		expect(scores.find((score) => score.router === "honest")?.wins).toBe(1);
		expect(scores.find((score) => score.router === "optimist")?.wins).toBe(0);
		// Ten percent short of the best floor.
		expect(scores.find((score) => score.router === "optimist")?.medianShortfallBps).toBe(1000);
	});

	it("counts failures without letting them distort the score", () => {
		const attempts: QuoteAttempt[][] = [
			[
				{ router: "a", ok: true, tookMs: 10, outputAmount: 100n, minimumOutputAmount: 100n },
				{ router: "b", ok: false, tookMs: 5000, because: "timed out" },
			],
			[
				{ router: "a", ok: true, tookMs: 20, outputAmount: 100n, minimumOutputAmount: 100n },
				{ router: "b", ok: true, tookMs: 30, outputAmount: 100n, minimumOutputAmount: 100n },
			],
		];

		const scores = scoreRouters(
			[{ name: "a" } as SwapRouter, { name: "b" } as SwapRouter],
			attempts,
		);
		const b = scores.find((score) => score.router === "b");

		expect(b?.failed).toBe(1);
		expect(b?.answered).toBe(1);
		expect(b?.wins).toBe(1);
		expect(b?.slowestMs).toBe(5000);
	});

	it("takes the middle time, so one slow answer does not decide anything", () => {
		const attempts: QuoteAttempt[][] = [10, 20, 2000].map((ms) => [
			{ router: "a", ok: true as const, tookMs: ms, outputAmount: 100n, minimumOutputAmount: 100n },
		]);

		expect(scoreRouters([{ name: "a" } as SwapRouter], attempts)[0]?.medianMs).toBe(20);
	});

	it("prefers the router that guarantees more, even when it is slower", () => {
		const scores = [
			{
				router: "fast",
				answered: 3,
				failed: 0,
				medianMs: 40,
				slowestMs: 50,
				wins: 1,
				medianShortfallBps: 30,
			},
			{
				router: "thorough",
				answered: 3,
				failed: 0,
				medianMs: 300,
				slowestMs: 400,
				wins: 2,
				medianShortfallBps: 0,
			},
		];

		expect(bestRouter(scores)).toBe("thorough");
	});

	it("breaks a tie on speed, and only then", () => {
		const scores = [
			{
				router: "slow",
				answered: 2,
				failed: 0,
				medianMs: 500,
				slowestMs: 600,
				wins: 2,
				medianShortfallBps: 0,
			},
			{
				router: "quick",
				answered: 2,
				failed: 0,
				medianMs: 40,
				slowestMs: 60,
				wins: 2,
				medianShortfallBps: 0,
			},
		];

		expect(bestRouter(scores)).toBe("quick");
	});

	it("ignores a router that never answered", () => {
		const scores = [
			{
				router: "absent",
				answered: 0,
				failed: 3,
				medianMs: 0,
				slowestMs: 9000,
				wins: 0,
				medianShortfallBps: 0,
			},
			{
				router: "present",
				answered: 3,
				failed: 0,
				medianMs: 100,
				slowestMs: 120,
				wins: 3,
				medianShortfallBps: 0,
			},
		];

		expect(bestRouter(scores)).toBe("present");
		expect(bestRouter([])).toBeUndefined();
	});

	it("names nobody when nobody answered", async () => {
		const clock = { now: 0 };
		const broken = fakeRouter("broken", [{ fails: "down", ms: 5 }], clock);

		const result = await compareRouters([broken], [request(1n)], { now: () => clock.now });

		expect(result.best).toBeUndefined();
		expect(result.scores[0]?.failed).toBe(1);
	});

	it("pauses between requests, so a comparison does not become an attack", async () => {
		const clock = { now: 0 };
		let pauses = 0;
		const router = fakeRouter(
			"a",
			[
				{ output: 1n, minimum: 1n, ms: 1 },
				{ output: 1n, minimum: 1n, ms: 1 },
				{ output: 1n, minimum: 1n, ms: 1 },
			],
			clock,
		);

		await compareRouters([router], [request(1n), request(2n), request(3n)], {
			now: () => clock.now,
			pause: async () => {
				pauses += 1;
			},
		});

		// Between the requests, not after the last one.
		expect(pauses).toBe(2);
	});
});
