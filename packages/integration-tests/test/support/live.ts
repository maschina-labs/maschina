/**
 * Running a test against a live service, without letting that service's bad minute fail the build.
 *
 * These tests exist to prove Maschina reads the real market correctly, so they have to talk to real
 * services. Those services occasionally answer with a 500 or a rate limit, and neither says anything
 * about our code. The distinction is exactly the one the runtime already makes: an error that means
 * "ask again" is retried, and every other error fails the test immediately.
 *
 * The free tiers are small, and measured rather than guessed. Jupiter's answers about five requests
 * in a burst and then refuses for several seconds, so retrying harder makes it worse: the retries are
 * themselves the burst. What works is never bursting. Every live call in a file goes through one
 * queue, one at a time, spaced far enough apart that the allowance refills as fast as it is spent.
 *
 * This is why the suite does not need an API key to be reliable, which is the point: a test suite
 * that is sometimes red for reasons unrelated to the code teaches everybody to ignore it.
 */

import { isMaschinaError } from "@maschina/core";

/** Codes that mean the service had a moment, rather than the code being wrong. */
const WORTH_RETRYING = new Set(["unavailable", "limit_exceeded"]);

/**
 * The gap between one live call starting and the next.
 *
 * Measured against Jupiter's free tier on 2026-10-16: eight requests back to back answered
 * 200 200 200 200 200 429 429 429, and once refused it kept refusing for about seven seconds. So the
 * allowance refills at roughly one request a second, and this sits just above it.
 */
const SPACING_MS = 1500;

/**
 * How long to wait after a refusal, doubling.
 *
 * Longer than the gap on purpose: being refused means the allowance is already empty, and the
 * measured cooldown was about seven seconds.
 */
const BACKOFF_MS = 4000;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The tail of the queue. Every live call waits for the one before it, then for the gap. */
let queue: Promise<unknown> = Promise.resolve();

/** Runs work after everything already queued, and holds the next one back for the spacing. */
function queued<T>(work: () => Promise<T>): Promise<T> {
	const result = queue.then(work, work);
	// The queue carries on whatever the result was: one failure must not wedge every later test.
	queue = result.then(
		() => pause(SPACING_MS),
		() => pause(SPACING_MS),
	);
	return result;
}

export type LiveOptions = {
	attempts?: number;
	/** How long to wait after the first failure. Doubles each time. */
	backoffMs?: number;
};

/**
 * Runs something against a live service, one at a time, retrying only "ask again" failures.
 *
 * A wrong answer, a refused request or a broken assertion fails on the first try, which is the point:
 * this hides an outage, never a bug.
 */
export async function live<T>(work: () => Promise<T>, options: LiveOptions = {}): Promise<T> {
	const attempts = options.attempts ?? 3;
	let waitMs = options.backoffMs ?? BACKOFF_MS;
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await queued(work);
		} catch (error) {
			if (!isMaschinaError(error) || !WORTH_RETRYING.has(error.code)) throw error;
			lastError = error;
			if (attempt < attempts) {
				await pause(waitMs);
				waitMs *= 2;
			}
		}
	}

	throw lastError;
}
