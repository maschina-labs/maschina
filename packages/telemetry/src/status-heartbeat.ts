import type { Logger } from "./logger.ts";

export type StatusHeartbeatOptions = {
	/** The address the status page gave this service. None, and the service does not report. */
	url: string | undefined;
	intervalMs: number;
	/** Whether the service can do its job right now: the same answer its `/ready` gives. */
	ready: () => Promise<boolean>;
	fetch?: typeof fetch;
	logger: Logger;
};

/**
 * Tells the status page this service is up, from the inside.
 *
 * Only the gateway can be reached from outside; the rest live on a private network and must stay there (the signer
 * above all), so nothing can ask them how they are. Each one speaks instead: it pings its heartbeat address while it
 * is ready, and goes quiet when it is not. The status page raises the alarm on the silence. A ping that fails is
 * logged and forgotten: reporting on the service must never be able to hurt it. Returns a function that stops it.
 */
export function startStatusHeartbeat({
	url,
	intervalMs,
	ready,
	fetch: call = fetch,
	logger,
}: StatusHeartbeatOptions): () => void {
	if (url === undefined) return () => undefined;

	const beat = async () => {
		const isReady = await ready().catch(() => false);
		if (!isReady) return;
		try {
			await call(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
		} catch (error) {
			logger.warn({ err: error }, "the status heartbeat could not be sent");
		}
	};

	void beat();
	const timer = setInterval(() => void beat(), intervalMs);
	// A heartbeat alone never keeps a process alive.
	timer.unref();
	return () => clearInterval(timer);
}
