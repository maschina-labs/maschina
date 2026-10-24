import { rgbaOf } from "@maschina/field";
import {
	type AutoscaleInfo,
	CandlestickSeries,
	ColorType,
	createChart,
	type ISeriesApi,
} from "lightweight-charts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { fetchCandles, streamCandles } from "./market-candles.ts";

function chartColor(value: string, opacity = 1) {
	const color = rgbaOf(value, opacity);
	if (!color) throw new Error("Invalid chart color");
	return color;
}
const ice = chartColor("oklch(94% 0.018 245)");
const dim = chartColor("oklch(60% 0.01 245)");

export default function MarketChart({
	loading,
	unavailable,
	connected,
	disconnected,
	bandWidth = 2.5,
	onPrice,
	labels,
	widthControl,
}: {
	loading: string;
	unavailable: string;
	connected: string;
	disconnected: string;
	bandWidth?: number;
	widthControl?: ReactNode;
	onPrice?: (price: number) => void;
	labels?: {
		width: string;
		center: string;
		inside: string;
		outside: string;
		lower: string;
		upper: string;
		reset: string;
	};
}) {
	const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const priceCallback = useRef(onPrice);
	priceCallback.current = onPrice;
	const anchor = useRef<number | undefined>(undefined);
	const [centerOffset, setCenterOffset] = useState(0);
	const [bounds, setBounds] = useState<{ top: number; bottom: number }>();
	const redraw = useRef<() => void>(() => {});
	const holder = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<"loading" | "live" | "offline" | "failed">("loading");
	const [price, setPrice] = useState<number>();
	useEffect(() => {
		if (!holder.current) return;
		const chart = createChart(holder.current, {
			autoSize: true,
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: dim,
				fontFamily: '"Sohne", ui-sans-serif, system-ui, sans-serif',
				attributionLogo: true,
			},
			grid: {
				vertLines: { visible: false },
				horzLines: { color: chartColor("oklch(94% 0.018 245)", 0.06) },
			},
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false, timeVisible: true, fixLeftEdge: true, fixRightEdge: true },
		});
		const series = chart.addSeries(CandlestickSeries, {
			upColor: ice,
			downColor: dim,
			wickUpColor: ice,
			wickDownColor: dim,
			borderVisible: false,
		});
		seriesRef.current = series;
		let closed = false;
		let stop = () => {};
		fetchCandles("SOLUSDT", "15m", 160)
			.then((candles) => {
				if (closed) return;
				if (!candles.length) throw new Error("No candles");
				series.setData(candles as never);
				chart.timeScale().fitContent();
				setPrice(candles.at(-1)?.close);
				anchor.current = candles.at(-1)?.close;
				if (anchor.current) priceCallback.current?.(anchor.current);
				setStatus("offline");
				stop = streamCandles(
					"SOLUSDT",
					"15m",
					(candle) => {
						if (closed) return;
						series.update(candle as never);
						setPrice(candle.close);
						priceCallback.current?.(candle.close);
						requestAnimationFrame(() => redraw.current());
						setStatus("live");
					},
					undefined,
					(live) => {
						if (!closed) setStatus(live ? "live" : "offline");
					},
				);
			})
			.catch(() => {
				if (!closed) setStatus("failed");
			});
		return () => {
			closed = true;
			stop();
			seriesRef.current = null;
			chart.remove();
		};
	}, []);
	const center =
		anchor.current === undefined ? undefined : anchor.current * (1 + centerOffset / 100);
	const lower = center === undefined ? undefined : center * (1 - bandWidth / 100);
	const upper = center === undefined ? undefined : center * (1 + bandWidth / 100);
	useEffect(() => {
		const series = seriesRef.current;
		if (!series || lower === undefined || upper === undefined || !labels) return;
		series.applyOptions({
			autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
				const info = original();
				return info?.priceRange
					? {
							...info,
							priceRange: {
								minValue: Math.min(info.priceRange.minValue, lower),
								maxValue: Math.max(info.priceRange.maxValue, upper),
							},
						}
					: null;
			},
		});
		const low = series.createPriceLine({
			price: lower,
			color: ice,
			lineWidth: 1,
			lineStyle: 2,
			title: labels.lower,
			axisLabelVisible: true,
		});
		const high = series.createPriceLine({
			price: upper,
			color: ice,
			lineWidth: 1,
			lineStyle: 2,
			title: labels.upper,
			axisLabelVisible: true,
		});
		const update = () => {
			const top = series.priceToCoordinate(upper);
			const bottom = series.priceToCoordinate(lower);
			if (top !== null && bottom !== null) setBounds({ top, bottom });
		};
		redraw.current = update;
		const frame = requestAnimationFrame(update);
		const observer = new ResizeObserver(() => requestAnimationFrame(update));
		if (holder.current) observer.observe(holder.current);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			series.removePriceLine(low);
			series.removePriceLine(high);
			redraw.current = () => {};
		};
	}, [lower, upper, labels]);
	const inside =
		price !== undefined &&
		lower !== undefined &&
		upper !== undefined &&
		price >= lower &&
		price <= upper;
	return (
		<div>
			<div className="flex flex-wrap items-baseline justify-between gap-3 pb-6">
				<span className="font-display text-xl text-white">
					SOL / USDT <span className="ml-2 font-sans text-xs text-neutral-500">15m · Binance</span>
				</span>
				<span className="font-sans text-xl text-[oklch(0.94_0.018_245)]">
					{price?.toFixed(2) ?? "-"} <span className="text-xs">USDT</span>
				</span>
			</div>
			<div
				className="relative overflow-hidden"
				onPointerMove={() => requestAnimationFrame(() => redraw.current())}
				onWheel={() => requestAnimationFrame(() => redraw.current())}
			>
				{bounds && labels ? (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 z-10 border-y border-[oklch(0.94_0.018_245/0.4)] bg-[oklch(0.94_0.018_245/0.08)]"
						style={{
							top: Math.max(0, bounds.top),
							height: Math.max(
								0,
								Math.min(holder.current?.clientHeight ?? bounds.bottom, bounds.bottom) -
									Math.max(0, bounds.top),
							),
						}}
					/>
				) : null}
				<div ref={holder} className="h-[16rem] w-full sm:h-[28rem]" />
				{status === "loading" || status === "failed" ? (
					<p
						role="status"
						className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center text-sm text-neutral-400"
					>
						{status === "failed" ? unavailable : loading}
					</p>
				) : null}
			</div>
			{labels ? (
				<div className="mt-6 grid gap-5 sm:grid-cols-2">
					{widthControl}
					<label className="text-sm text-neutral-300">
						{labels.center}{" "}
						<span className="float-right font-sans">
							{centerOffset > 0 ? "+" : ""}
							{centerOffset.toFixed(1)}%
						</span>
						<input
							type="range"
							min="-5"
							max="5"
							step="0.1"
							value={centerOffset}
							onChange={(event) => setCenterOffset(Number(event.target.value))}
							className="mt-4 block w-full accent-[oklch(0.94_0.018_245)]"
						/>
					</label>
					<div className="flex items-center justify-between gap-4 text-sm text-neutral-400 sm:col-span-2">
						<span>{price === undefined ? loading : inside ? labels.inside : labels.outside}</span>
						<button
							type="button"
							onClick={() => {
								anchor.current = price;
								setCenterOffset(0);
								setBounds(undefined);
							}}
							className="shrink-0 border border-[oklch(0.94_0.018_245/0.2)] px-3 py-2 text-neutral-200 hover:bg-white/5"
						>
							{labels.reset}
						</button>
					</div>
				</div>
			) : null}
			<p role="status" className="mt-4 text-xs text-neutral-500">
				{status === "live" ? connected : status === "offline" ? disconnected : ""}
			</p>
		</div>
	);
}
