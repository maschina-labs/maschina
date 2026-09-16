/**
 * Service-to-service authentication with a shared secret. Used on internal routes, such as a daemon
 * asking the orchestrator for work. Compared in constant time so the secret can't be guessed a
 * character at a time.
 */

import { timingSafeEqual } from "node:crypto";
import { MaschinaError } from "@maschina/core";
import type { MiddlewareHandler } from "hono";

export function requireServiceToken(expected: string): MiddlewareHandler {
	const wanted = Buffer.from(expected);
	return async (c, next) => {
		const header = c.req.header("authorization") ?? "";
		const presented = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
		const valid = presented.length === wanted.length && timingSafeEqual(presented, wanted);
		if (!valid) throw new MaschinaError("unauthenticated", "a valid service token is required");
		await next();
	};
}
