import { describe, expect, it, vi } from "vitest";
import { candleFromMessage, candleFromRow, fetchCandles } from "./candles.ts";

const row = [1790550000000, "119.40", "119.95", "119.10", "119.72", "1234.5", 1790550899999];

describe("reading candles", () => {
	it("reads a row of history into a candle, in seconds", () => {
		expect(candleFromRow(row)).toEqual({
			time: 1790550000,
			open: 119.4,
			high: 119.95,
			low: 119.1,
			close: 119.72,
			volume: 1234.5,
		});
	});

	it("shifts the time to the viewer's clock, so the dial reads local time", () => {
		// Toronto in September is UTC-4, which getTimezoneOffset reports as 240.
		expect(candleFromRow(row, 240)?.time).toBe(1790550000 - 240 * 60);
	});

	it("drops a row it cannot read rather than drawing a broken candle", () => {
		expect(candleFromRow([1790550000000, "abc", "1", "1", "1"])).toBeUndefined();
		expect(candleFromRow(["later", "1", "1", "1", "1"])).toBeUndefined();
	});

	it("reads a live candle from the stream, and ignores anything else", () => {
		const message = {
			e: "kline",
			k: { t: 1790550000000, o: "119.4", h: "120", l: "119", c: "119.8" },
		};
		expect(candleFromMessage(message)?.close).toBe(119.8);
		expect(candleFromMessage({ result: null })).toBeUndefined();
		expect(candleFromMessage(null)).toBeUndefined();
	});

	it("asks for exactly the market and range wanted, and keeps only readable rows", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify([row, ["bad"]])));
		const candles = await fetchCandles("SOLUSDT", "15m", 200, fetcher as never, 0);

		expect(fetcher).toHaveBeenCalledWith(
			"https://data-api.binance.vision/api/v3/klines?symbol=SOLUSDT&interval=15m&limit=200",
		);
		expect(candles).toHaveLength(1);
	});

	it("says so when the history cannot be read", async () => {
		const fetcher = vi.fn(async () => new Response("", { status: 451 }));
		await expect(fetchCandles("SOLUSDT", "15m", 200, fetcher as never)).rejects.toThrow(/451/);
	});
});
