import { useEffect, useRef, useState } from "react";
import type { PnlPoint } from "../lib/pnl.ts";
import { niceTicks, smoothPath } from "../lib/smooth-line.ts";

/**
 * Realized profit over time: one smooth line, a point for every sale, the zero line dashed so a loss reads
 * as below it. Drawn here rather than in a trading chart: profit is a running total, not prices, so it has
 * no candles, no wicks and no reason for corners. Colors come from the theme, so it follows light and dark.
 */

const PAD = { top: 12, right: 56, bottom: 22, left: 4 };

const dollars = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
const when = (seconds: number) =>
	new Date(seconds * 1000).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

export function PnlChartView({ points }: { points: PnlPoint[] }) {
	const holder = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	useEffect(() => {
		const element = holder.current;
		if (!element) return;
		const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
		measure();
		const watch = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
		watch?.observe(element);
		return () => watch?.disconnect();
	}, []);

	if (points.length === 0) {
		return (
			<p className="text-[11px] text-neutral-500 tracking-[0.1em]">
				NO SALES YET · THE LINE STARTS AT THE FIRST ONE
			</p>
		);
	}

	// Two sales in the same second are one moment, so the later one stands.
	const series = [
		...new Map(points.map((point) => [point.time, Number(point.value) / 1_000_000])),
	].map(([time, value]) => ({ time, value }));
	const values = series.map((each) => each.value);
	const low = Math.min(0, ...values);
	const high = Math.max(0, ...values);
	const room = high - low || 1;
	const first = series[0]?.time ?? 0;
	const last = series.at(-1)?.time ?? first;
	const span = last - first || 1;
	const { width, height } = size;
	const plotW = Math.max(width - PAD.left - PAD.right, 1);
	const plotH = Math.max(height - PAD.top - PAD.bottom, 1);
	const x = (time: number) =>
		PAD.left + (series.length === 1 ? plotW : ((time - first) / span) * plotW);
	const y = (value: number) => PAD.top + (1 - (value - low) / room) * plotH;
	const line = series.map((each) => ({ x: x(each.time), y: y(each.value) }));
	const end = series.at(-1);

	return (
		<div ref={holder} data-testid="pnl-chart" className="relative h-64 w-full text-white">
			{width > 0 ? (
				<svg width={width} height={height} role="img" aria-label="Realized profit over time">
					{niceTicks(low, high).map((tick) => (
						<g key={tick}>
							<line
								x1={PAD.left}
								x2={PAD.left + plotW}
								y1={y(tick)}
								y2={y(tick)}
								stroke="currentColor"
								strokeOpacity={0.05}
							/>
							<text
								x={width - 4}
								y={y(tick) + 3.5}
								textAnchor="end"
								className="fill-neutral-500 font-mono text-[10px]"
							>
								{dollars(tick)}
							</text>
						</g>
					))}
					<line
						x1={PAD.left}
						x2={PAD.left + plotW}
						y1={y(0)}
						y2={y(0)}
						stroke="currentColor"
						strokeOpacity={0.25}
						strokeDasharray="3 4"
					/>
					<path
						d={smoothPath(line)}
						fill="none"
						stroke="currentColor"
						strokeOpacity={0.9}
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					{end ? <circle cx={x(end.time)} cy={y(end.value)} r={2.5} fill="currentColor" /> : null}
					<text x={PAD.left} y={height - 4} className="fill-neutral-500 font-mono text-[10px]">
						{when(first)}
					</text>
					<text
						x={PAD.left + plotW}
						y={height - 4}
						textAnchor="end"
						className="fill-neutral-500 font-mono text-[10px]"
					>
						{when(last)}
					</text>
				</svg>
			) : null}
			{end ? (
				<span className="absolute top-0 left-1 font-mono text-[12px] text-neutral-100">
					{dollars(end.value)}
				</span>
			) : null}
		</div>
	);
}
