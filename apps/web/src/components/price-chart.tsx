import {
	CandlestickSeries,
	ColorType,
	CrosshairMode,
	createChart,
	createSeriesMarkers,
	HistogramSeries,
	type IChartApi,
	type IPriceLine,
	type ISeriesApi,
	type ISeriesMarkersPluginApi,
	LineStyle,
	type Time,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { type Candle, fetchCandles, streamCandles } from "../lib/candles.ts";
import { candleTime, type Trade } from "../lib/trades.ts";

/**
 * Candles floating straight on the fog: no background and no borders, a faint grid, the price dial on the
 * right and the time dial along the bottom. Drawn by TradingView's open source Lightweight Charts.
 *
 * Colours here are rgba rather than OKLCH on purpose: the library mixes colours itself on its canvas and
 * only reads rgb and hex. Each one is the sRGB twin of a neutral OKLCH grey.
 */

// Monochrome on purpose: light for up, dim for down. Ash tried green and red and wants neither.
const UP = "rgba(236, 236, 236, 0.92)"; // oklch(0.94 0 0)
const DOWN = "rgba(128, 128, 128, 0.9)"; // oklch(0.6 0 0)
const GRID = "rgba(255, 255, 255, 0.045)";
const DIAL = "rgba(163, 163, 163, 0.75)"; // oklch(0.72 0 0)
const CROSSHAIR = "rgba(255, 255, 255, 0.25)";
const LABEL = "rgba(38, 38, 38, 0.95)"; // oklch(0.27 0 0)
const BAND = "rgba(229, 229, 229, 0.45)"; // oklch(0.92 0 0 / 0.45)
const VOLUME = "rgba(255, 255, 255, 0.09)";
const MARK = "rgba(245, 245, 245, 0.95)"; // oklch(0.97 0 0)

/** A price drawn across the chart as a dashed line with its name on the dial: a machine's band. */
export type Level = { price: number; label: string };

export function PriceChart({
	symbol = "SOLUSDT",
	interval = "15m",
	history = 300,
	levels = [],
	trades = [],
	onLive,
	onPrice,
}: {
	symbol?: string;
	interval?: string;
	history?: number;
	levels?: Level[];
	/** The machine's own buys and sells, pinned on the candles they happened in. */
	trades?: Trade[];
	/** Told whether the live stream is connected. */
	onLive?: (live: boolean) => void;
	/** Told the latest price with every trade the stream reports. */
	onPrice?: (price: number) => void;
}) {
	const holder = useRef<HTMLDivElement>(null);
	const series = useRef<ISeriesApi<"Candlestick">>(undefined);
	const pins = useRef<ISeriesMarkersPluginApi<Time>>(undefined);
	const [failed, setFailed] = useState<string>();
	/** The candle under the pointer, for the readout; the latest one when the pointer is elsewhere. */
	const [hover, setHover] = useState<Candle>();
	const latest = useRef<Candle>(undefined);

	useEffect(() => {
		if (!holder.current) return;
		const chart: IChartApi = createChart(holder.current, {
			autoSize: true,
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: DIAL,
				fontFamily: '"Geist Mono", ui-monospace, monospace',
				fontSize: 11,
				// The library's licence asks for its mark to stay on the chart.
				attributionLogo: true,
			},
			grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
			rightPriceScale: { borderVisible: false },
			timeScale: {
				borderVisible: false,
				timeVisible: true,
				secondsVisible: false,
				// The chart stops at the first candle and the live one: nothing to scroll into on either side.
				fixLeftEdge: true,
				fixRightEdge: true,
			},
			crosshair: {
				mode: CrosshairMode.Normal,
				vertLine: { color: CROSSHAIR, style: LineStyle.Dashed, labelBackgroundColor: LABEL },
				horzLine: { color: CROSSHAIR, style: LineStyle.Dashed, labelBackgroundColor: LABEL },
			},
		});
		const candles = chart.addSeries(CandlestickSeries, {
			upColor: UP,
			downColor: DOWN,
			borderVisible: false,
			wickUpColor: UP,
			wickDownColor: DOWN,
			priceLineColor: CROSSHAIR,
			priceLineStyle: LineStyle.Dashed,
		});
		series.current = candles;
		pins.current = createSeriesMarkers(candles, []);
		// Volume sits faintly along the bottom fifth, on its own scale so it never squeezes the candles.
		const volume = chart.addSeries(HistogramSeries, {
			color: VOLUME,
			priceFormat: { type: "volume" },
			priceScaleId: "",
			lastValueVisible: false,
			priceLineVisible: false,
		});
		volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
		const bar = (candle: Candle) => ({ time: candle.time, value: candle.volume });
		const known = new Map<number, Candle>();
		chart.subscribeCrosshairMove((move) => {
			const at = typeof move.time === "number" ? known.get(move.time) : undefined;
			setHover(at ?? latest.current);
		});

		let stop = () => {};
		let closed = false;
		fetchCandles(symbol, interval, history)
			.then((past: Candle[]) => {
				if (closed) return;
				candles.setData(past as never);
				volume.setData(past.map(bar) as never);
				for (const candle of past) known.set(candle.time, candle);
				latest.current = past.at(-1);
				setHover(latest.current);
				if (latest.current) onPrice?.(latest.current.close);
				stop = streamCandles(
					symbol,
					interval,
					(live) => {
						candles.update(live as never);
						volume.update(bar(live) as never);
						known.set(live.time, live);
						latest.current = live;
						onPrice?.(live.close);
					},
					undefined,
					onLive,
				);
			})
			.catch((error: unknown) => setFailed(error instanceof Error ? error.message : "no prices"));

		return () => {
			closed = true;
			stop();
			series.current = undefined;
			pins.current = undefined;
			chart.remove();
		};
		// onLive is a callback for the page; a new one each render must not rebuild the chart.
	}, [symbol, interval, history]);

	// The machine's own trades, pinned on the candle each happened in: a buy under it, a sale over it.
	const traded = trades.map((trade) => `${trade.at}${trade.side}`).join();
	useEffect(() => {
		const offset = new Date().getTimezoneOffset();
		pins.current?.setMarkers(
			trades.map((trade) => ({
				time: candleTime(trade.at, interval, offset) as never,
				position: trade.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
				shape: trade.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
				color: MARK,
				text: `${trade.side.toUpperCase()} ${trade.price.toFixed(2)}`,
			})),
		);
		// The joined key stands for the trades, so the same trades in a new array do nothing.
	}, [traded, interval]);

	// The band follows the machine, not the market, so it is drawn apart from the candles.
	const key = levels.map((level) => `${level.label}${level.price}`).join();
	useEffect(() => {
		const candles = series.current;
		if (!candles || !key) return;
		const lines: IPriceLine[] = levels.map((level) =>
			candles.createPriceLine({
				price: level.price,
				title: level.label,
				color: BAND,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: true,
				axisLabelColor: LABEL,
				axisLabelTextColor: "rgba(229, 229, 229, 0.95)",
			}),
		);
		return () => {
			for (const line of lines) candles.removePriceLine(line);
		};
		// The key stands for the levels, so a new array with the same lines draws nothing again.
	}, [key]);

	return (
		<div className="relative h-full w-full">
			<div ref={holder} data-testid="price-chart" className="h-full w-full" />
			{hover ? (
				<p
					data-testid="candle"
					className="pointer-events-none absolute top-1 left-1 z-10 flex gap-3 text-[10.5px] text-neutral-500 tabular-nums tracking-[0.1em]"
				>
					{(
						[
							["O", hover.open],
							["H", hover.high],
							["L", hover.low],
							["C", hover.close],
						] as const
					).map(([label, value]) => (
						<span key={label}>
							{label} <span className="text-neutral-200">{value.toFixed(2)}</span>
						</span>
					))}
				</p>
			) : null}
			{failed ? (
				<p
					role="alert"
					className="absolute inset-0 grid place-items-center text-[12px] text-neutral-500"
				>
					{failed}
				</p>
			) : null}
		</div>
	);
}
