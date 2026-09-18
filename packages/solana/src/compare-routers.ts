/**
 * Asking two routers the same question and keeping score.
 *
 * A machine uses one router by default, and the only honest way to choose it is to measure. Two things
 * are measured, and they are not the same thing:
 *
 *   how much a trade is guaranteed to receive, judged on `minimumOutputAmount`, the floor
 *   how long the answer took, because a quote that arrives late is a quote against a price that moved
 *
 * The floor decides, not the hoped-for amount. A router that promises more and guarantees less is
 * offering optimism, and a machine cannot spend optimism.
 */

import type { QuoteRequest, SwapRouter } from "./router.ts";

export type QuoteAttempt =
	| { router: string; ok: true; tookMs: number; outputAmount: bigint; minimumOutputAmount: bigint }
	| { router: string; ok: false; tookMs: number; because: string };

export type RouterScore = {
	router: string;
	answered: number;
	failed: number;
	/** The middle answer time, which a slow outlier cannot drag around. */
	medianMs: number;
	slowestMs: number;
	/** How often this router guaranteed the most of any router asked. */
	wins: number;
	/**
	 * How far this router sat from the best answer, in basis points, at the middle of its results.
	 * Zero means it was the best one every time it answered.
	 */
	medianShortfallBps: number;
};

export type Comparison = {
	requests: number;
	attempts: QuoteAttempt[][];
	scores: RouterScore[];
	/** The router with the most wins, and the faster one when two are level. */
	best?: string;
};

export type CompareOptions = {
	now?: () => number;
	/** Called between requests, so a comparison does not hammer a rate limited API. */
	pause?: () => Promise<void>;
};

const median = (values: number[]): number => {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
	return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
};

/** Asks every router for the same quote, one request at a time, and records what happened. */
export async function compareRouters(
	routers: SwapRouter[],
	requests: QuoteRequest[],
	options: CompareOptions = {},
): Promise<Comparison> {
	const now = options.now ?? (() => Date.now());
	const attempts: QuoteAttempt[][] = [];

	for (const [index, request] of requests.entries()) {
		// Asked at the same moment, because the market moves between one question and the next.
		const round = await Promise.all(
			routers.map(async (router): Promise<QuoteAttempt> => {
				const startedAt = now();
				try {
					const quote = await router.quote(request);
					return {
						router: router.name,
						ok: true,
						tookMs: now() - startedAt,
						outputAmount: quote.outputAmount,
						minimumOutputAmount: quote.minimumOutputAmount,
					};
				} catch (error) {
					return {
						router: router.name,
						ok: false,
						tookMs: now() - startedAt,
						because: error instanceof Error ? error.message : String(error),
					};
				}
			}),
		);
		attempts.push(round);
		if (options.pause && index < requests.length - 1) await options.pause();
	}

	const scores = scoreRouters(routers, attempts);
	const best = bestRouter(scores);
	return { requests: requests.length, attempts, scores, ...(best ? { best } : {}) };
}

/** Turns the raw attempts into a score per router. */
export function scoreRouters(routers: SwapRouter[], attempts: QuoteAttempt[][]): RouterScore[] {
	return routers.map((router) => {
		const mine = attempts
			.map((round) => round.find((attempt) => attempt.router === router.name))
			.filter((attempt): attempt is QuoteAttempt => attempt !== undefined);

		const answered = mine.filter((attempt) => attempt.ok);
		const times = mine.map((attempt) => attempt.tookMs);

		let wins = 0;
		const shortfalls: number[] = [];

		for (const round of attempts) {
			const best = round.reduce<bigint>(
				(most, attempt) =>
					attempt.ok && attempt.minimumOutputAmount > most ? attempt.minimumOutputAmount : most,
				0n,
			);
			if (best === 0n) continue;

			const ours = round.find((attempt) => attempt.router === router.name);
			if (!ours?.ok) continue;

			if (ours.minimumOutputAmount === best) wins += 1;
			shortfalls.push(Number(((best - ours.minimumOutputAmount) * 10_000n) / best));
		}

		return {
			router: router.name,
			answered: answered.length,
			failed: mine.length - answered.length,
			medianMs: median(times),
			slowestMs: times.length === 0 ? 0 : Math.max(...times),
			wins,
			medianShortfallBps: median(shortfalls),
		};
	});
}

/**
 * The router to make the default: the one that guaranteed the most, most often. Speed only breaks a tie,
 * because a faster router that gets less is worse.
 */
export function bestRouter(scores: RouterScore[]): string | undefined {
	const usable = scores.filter((score) => score.answered > 0);
	if (usable.length === 0) return undefined;

	return usable.reduce((leader, score) => {
		if (score.wins !== leader.wins) return score.wins > leader.wins ? score : leader;
		return score.medianMs < leader.medianMs ? score : leader;
	}).router;
}
