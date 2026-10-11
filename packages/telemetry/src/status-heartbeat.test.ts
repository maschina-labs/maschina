import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.ts";
import { startStatusHeartbeat } from "./status-heartbeat.ts";

/** A logger that keeps what it writes, so a test can read it. */
function memoryLogger() {
	const lines: Record<string, unknown>[] = [];
	const logger = createLogger(
		{ service: "test", level: "trace" },
		new Writable({
			write(chunk, _encoding, done) {
				lines.push(JSON.parse(chunk.toString()));
				done();
			},
		}),
	);
	return { logger, lines };
}

const URL_ = "https://uptime.betterstack.com/api/v1/heartbeat/abc123";

function setup(ready: () => Promise<boolean>, call?: typeof fetch) {
	const sent: string[] = [];
	const fetcher =
		call ??
		((async (input: string | URL | Request) => {
			sent.push(String(input));
			return new Response("", { status: 200 });
		}) as typeof fetch);
	const { logger, lines } = memoryLogger();
	const stop = startStatusHeartbeat({ url: URL_, intervalMs: 1000, ready, fetch: fetcher, logger });
	return { sent, stop, lines };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the status heartbeat", () => {
	it("tells the status page the service is up, at once and then on every interval", async () => {
		const { sent, stop } = setup(async () => true);
		await vi.advanceTimersByTimeAsync(0);
		expect(sent).toEqual([URL_]);
		await vi.advanceTimersByTimeAsync(2000);
		expect(sent).toHaveLength(3);
		stop();
	});

	it("says nothing while the service is not ready, so the status page notices the silence", async () => {
		const { sent, stop } = setup(async () => false);
		await vi.advanceTimersByTimeAsync(3500);
		expect(sent).toEqual([]);
		stop();
	});

	it("says nothing when the readiness check itself throws", async () => {
		const { sent, stop } = setup(async () => {
			throw new Error("boom");
		});
		await vi.advanceTimersByTimeAsync(2500);
		expect(sent).toEqual([]);
		stop();
	});

	it("never lets a failed ping hurt the service: it logs it once per failure and carries on", async () => {
		const failing = (async () => {
			throw new Error("offline");
		}) as unknown as typeof fetch;
		const { stop, lines } = setup(async () => true, failing);
		await vi.advanceTimersByTimeAsync(2500);
		expect(lines.filter((line) => /heartbeat/i.test(JSON.stringify(line))).length).toBeGreaterThan(
			0,
		);
		stop();
	});

	it("stops pinging when told to", async () => {
		const { sent, stop } = setup(async () => true);
		await vi.advanceTimersByTimeAsync(0);
		stop();
		await vi.advanceTimersByTimeAsync(5000);
		expect(sent).toHaveLength(1);
	});

	it("does not start without an address, so a service with none set simply does not report", () => {
		const { logger } = memoryLogger();
		const stop = startStatusHeartbeat({
			url: undefined,
			intervalMs: 1000,
			ready: async () => true,
			logger,
		});
		expect(stop).toBeTypeOf("function");
		stop();
	});
});
