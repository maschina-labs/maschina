import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { candleTime } from "../lib/trades.ts";

// No canvas in a test browser, so the chart library is stood in for. What is tested is the wiring:
// history first, then the live stream, and everything torn down when the chart leaves the screen.
const setData = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const createPriceLine = vi.fn((line: unknown) => line);
const removePriceLine = vi.fn();
const setMarkers = vi.fn();
const options: unknown[] = [];
vi.mock("lightweight-charts", () => ({
	CandlestickSeries: "candles",
	HistogramSeries: "volume",
	ColorType: { Solid: "solid" },
	CrosshairMode: { Normal: 0 },
	LineStyle: { Dashed: 2 },
	createSeriesMarkers: () => ({ setMarkers }),
	createChart: (_: unknown, given: unknown) => {
		options.push(given);
		return {
			addSeries: () => ({
				setData,
				update,
				createPriceLine,
				removePriceLine,
				priceScale: () => ({ applyOptions: vi.fn() }),
			}),
			subscribeCrosshairMove: vi.fn(),
			remove,
		};
	},
}));

const stop = vi.fn();
let live: ((candle: unknown) => void) | undefined;
const fetchCandles = vi.fn();
vi.mock("../lib/candles.ts", () => ({
	fetchCandles: (...args: unknown[]) => fetchCandles(...args),
	streamCandles: (_s: string, _i: string, onCandle: (candle: unknown) => void) => {
		live = onCandle;
		return stop;
	},
}));

const { PriceChart } = await import("./price-chart.tsx");
const candle = { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };

beforeEach(() => {
	vi.clearAllMocks();
	options.length = 0;
	live = undefined;
});

describe("the price chart", () => {
	it("floats: no background and no borders on its dials", () => {
		fetchCandles.mockResolvedValue([]);
		render(<PriceChart />);

		expect(options[0]).toMatchObject({
			layout: { background: { color: "transparent" } },
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
		});
	});

	it("draws the history, then keeps the last candle live", async () => {
		fetchCandles.mockResolvedValue([candle]);
		render(<PriceChart />);

		await waitFor(() => expect(setData).toHaveBeenCalledWith([candle]));
		expect(setData).toHaveBeenCalledWith([{ time: 1, value: 10 }]);
		expect(screen.getByTestId("candle")).toHaveTextContent("C 1.50");
		live?.({ ...candle, close: 1.7 });
		expect(update).toHaveBeenCalledWith({ ...candle, close: 1.7 });
		expect(update).toHaveBeenCalledWith({ time: 1, value: 10 });
	});

	it("stops the stream and removes the chart when it leaves the screen", async () => {
		fetchCandles.mockResolvedValue([candle]);
		const { unmount } = render(<PriceChart />);
		await waitFor(() => expect(live).toBeDefined());

		unmount();
		expect(stop).toHaveBeenCalled();
		expect(remove).toHaveBeenCalled();
	});

	it("says why when there are no prices to draw", async () => {
		fetchCandles.mockRejectedValue(new Error("the price history answered 451"));
		render(<PriceChart />);

		expect(await screen.findByRole("alert")).toHaveTextContent("451");
	});

	it("draws a machine's band as named lines, and takes them away when it changes", () => {
		fetchCandles.mockResolvedValue([]);
		const band = [
			{ price: 121.2, label: "SELL" },
			{ price: 118.8, label: "BUY" },
		];
		const { rerender } = render(<PriceChart levels={band} />);

		expect(createPriceLine).toHaveBeenCalledWith(
			expect.objectContaining({ price: 121.2, title: "SELL" }),
		);
		expect(createPriceLine).toHaveBeenCalledWith(
			expect.objectContaining({ price: 118.8, title: "BUY" }),
		);
		rerender(<PriceChart levels={[{ price: 119, label: "BUY" }]} />);
		expect(removePriceLine).toHaveBeenCalledTimes(2);
	});

	it("pins the machine's trades on the candles they happened in, and leaves off any from before", async () => {
		const at = Date.parse("2026-09-28T06:22:39Z");
		// One candle from an hour before the trade: the chart starts there.
		fetchCandles.mockResolvedValue([
			// In local time, as the candles the app loads are.
			{
				time: candleTime(at - 3_600_000, "15m", new Date().getTimezoneOffset()),
				open: 1,
				high: 1,
				low: 1,
				close: 1,
				volume: 1,
			},
		]);
		render(
			<PriceChart
				interval="15m"
				trades={[
					{ at, side: "buy", price: 118.78 },
					{ at: at - 86_400_000, side: "sell", price: 120 },
				]}
			/>,
		);
		await vi.waitFor(() =>
			expect(setMarkers).toHaveBeenLastCalledWith([
				expect.objectContaining({ position: "belowBar", shape: "arrowUp", text: "BUY 118.78" }),
			]),
		);
	});
});
