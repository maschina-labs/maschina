/**
 * Running a test against a live service, without letting that service's bad minute fail the build.
 *
 * These tests exist to prove Maschina reads the real market correctly, so they have to talk to real
 * services. Those services occasionally answer with a 500 or a rate limit, and neither says anything
 * about our code. The distinction is exactly the one the runtime already makes: an error that means
 * "ask again" is retried, and every other error fails the test immediately.
 */

import { isMaschinaError } from "@maschina/core";

/** Codes that mean the service had a moment, rather than the code being wrong. */
const WORTH_RETRYING = new Set(["unavailable", "limit_exceeded"]);

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type LiveOptions = {
	attempts?: number;
	/** How long to wait after the first failure. Doubles each time. */
	backoffMs?: number;
};

/**
 * Runs something against a live service, retrying only the failures that mean "ask again".
 *
 * A wrong answer, a refused request or a broken assertion fails on the first try, which is the point:
 * this hides an outage, never a bug.
 */
export async function live<T>(work: () => Promise<T>, options: LiveOptions = {}): Promise<T> {
	const attempts = options.attempts ?? 3;
	let waitMs = options.backoffMs ?? 1500;
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await work();
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
