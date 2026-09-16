/**
 * The daemon dials out. It checks in with the orchestrator on a steady beat, and backs off when the
 * orchestrator can't be reached, so a restart doesn't turn every daemon into a flood of retries.
 */

import type { Logger } from "@maschina/telemetry";

export type BackoffOptions = {
	baseMs: number;
	maxMs: number;
	/** Returns a number in [0, 1). Injected so tests are deterministic. */
	random?: () => number;
};

/** Exponential backoff with full jitter. `failures` counts consecutive failures, from 1. */
export function backoffDelay(failures: number, options: BackoffOptions): number {
	const { baseMs, maxMs, random = Math.random } = options;
	const ceiling = Math.min(maxMs, baseMs * 2 ** Math.max(0, failures - 1));
	return Math.floor(random() * ceiling);
}

export type HeartbeatOptions = {
	orchestratorUrl: string;
	token: string;
	intervalMs: number;
	logger: Logger;
	fetch?: typeof fetch;
	sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
	backoff?: Omit<BackoffOptions, "baseMs">;
};

export async function checkIn(url: string, token: string, fetchFn: typeof fetch): Promise<boolean> {
	try {
		const response = await fetchFn(new URL("/internal/v1/hello", url), {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(5_000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

const defaultSleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});

/** Runs until `signal` aborts. Resolves once the loop has stopped. */
export async function runHeartbeat(options: HeartbeatOptions, signal: AbortSignal): Promise<void> {
	const {
		orchestratorUrl,
		token,
		intervalMs,
		logger,
		fetch: fetchFn = fetch,
		sleep = defaultSleep,
		backoff = { maxMs: 60_000 },
	} = options;
	let failures = 0;

	while (!signal.aborted) {
		const ok = await checkIn(orchestratorUrl, token, fetchFn);
		if (ok) {
			if (failures > 0) logger.info({ after: failures }, "orchestrator reachable again");
			failures = 0;
			await sleep(intervalMs, signal);
			continue;
		}
		failures++;
		const delay = backoffDelay(failures, { baseMs: 1_000, ...backoff });
		logger.warn({ failures, retryInMs: delay }, "orchestrator unreachable");
		await sleep(delay, signal);
	}
}
