import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { backoffDelay, checkIn, runHeartbeat } from "./heartbeat.ts";

const logger = createLogger({ service: "t", level: "silent" });

describe("backoffDelay", () => {
	it("doubles the ceiling with each failure, up to the maximum", () => {
		const max = () => 0.999_999;
		expect(backoffDelay(1, { baseMs: 1_000, maxMs: 60_000, random: max })).toBe(999);
		expect(backoffDelay(3, { baseMs: 1_000, maxMs: 60_000, random: max })).toBe(3_999);
		expect(backoffDelay(20, { baseMs: 1_000, maxMs: 60_000, random: max })).toBe(59_999);
	});

	it("spreads retries out with jitter", () => {
		expect(backoffDelay(5, { baseMs: 1_000, maxMs: 60_000, random: () => 0 })).toBe(0);
		expect(backoffDelay(5, { baseMs: 1_000, maxMs: 60_000, random: () => 0.5 })).toBe(8_000);
	});

	it("uses Math.random by default and stays in range", () => {
		const delay = backoffDelay(2, { baseMs: 1_000, maxMs: 60_000 });
		expect(delay).toBeGreaterThanOrEqual(0);
		expect(delay).toBeLessThan(2_000);
	});
});

describe("checkIn", () => {
	it("sends the token and reports success", async () => {
		const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
		expect(await checkIn("http://orchestrator:4100", "tok", fetchFn)).toBe(true);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(url.toString()).toBe("http://orchestrator:4100/internal/v1/hello");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("reports failure for a refusal or a network error", async () => {
		expect(await checkIn("http://x", "t", async () => new Response("", { status: 401 }))).toBe(
			false,
		);
		expect(
			await checkIn("http://x", "t", async () => {
				throw new TypeError("fetch failed");
			}),
		).toBe(false);
	});
});

describe("runHeartbeat", () => {
	it("checks in on the interval, backs off when unreachable, and stops when told", async () => {
		const results = [true, false, false, true];
		const stop = new AbortController();
		const sleeps: number[] = [];
		const fetchFn = vi.fn(async () => {
			const ok = results.shift() ?? true;
			if (results.length === 0) stop.abort();
			return new Response("", { status: ok ? 200 : 503 });
		});

		await runHeartbeat(
			{
				orchestratorUrl: "http://x",
				token: "t",
				intervalMs: 15_000,
				logger,
				fetch: fetchFn,
				sleep: async (ms) => void sleeps.push(ms),
				backoff: { maxMs: 60_000, random: () => 0.5 },
			},
			stop.signal,
		);

		expect(fetchFn).toHaveBeenCalledTimes(4);
		expect(sleeps).toEqual([15_000, 500, 1_000, 15_000]);
	});

	it("wakes from its sleep as soon as it is stopped", async () => {
		const stop = new AbortController();
		const running = runHeartbeat(
			{
				orchestratorUrl: "http://x",
				token: "t",
				intervalMs: 60 * 60_000,
				logger,
				fetch: async () => new Response("", { status: 200 }),
			},
			stop.signal,
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		stop.abort();
		await expect(running).resolves.toBeUndefined();
	});
});
