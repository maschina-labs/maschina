/**
 * A per-client token bucket, held in memory. Enough for one instance; once the gateway runs on
 * several, the counts move to a shared store so a client can't multiply its allowance.
 */

import { type Clock, MaschinaError, systemClock } from "@maschina/core";
import type { Context, MiddlewareHandler } from "hono";

export type RateLimitOptions = {
	/** Requests allowed in a burst. */
	capacity: number;
	/** Requests restored per second. */
	refillPerSecond: number;
	key: (c: Context) => string;
	clock?: Clock;
	/** Buckets untouched for this long are forgotten, so memory doesn't grow forever. */
	idleMs?: number;
};

type Bucket = { tokens: number; updated: number };

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
	const { capacity, refillPerSecond, key, clock = systemClock, idleMs = 10 * 60_000 } = options;
	const buckets = new Map<string, Bucket>();
	let lastSweep = clock.now().getTime();

	return async (c, next) => {
		const now = clock.now().getTime();

		if (now - lastSweep > idleMs) {
			for (const [id, bucket] of buckets) if (now - bucket.updated > idleMs) buckets.delete(id);
			lastSweep = now;
		}

		const id = key(c);
		const bucket = buckets.get(id) ?? { tokens: capacity, updated: now };
		const refilled = Math.min(
			capacity,
			bucket.tokens + ((now - bucket.updated) / 1000) * refillPerSecond,
		);

		if (refilled < 1) {
			buckets.set(id, { tokens: refilled, updated: now });
			const retryAfter = Math.ceil((1 - refilled) / refillPerSecond);
			c.header("retry-after", String(retryAfter));
			throw new MaschinaError("limit_exceeded", "too many requests", { details: { retryAfter } });
		}

		buckets.set(id, { tokens: refilled - 1, updated: now });
		c.header("x-ratelimit-remaining", String(Math.floor(refilled - 1)));
		await next();
	};
}
