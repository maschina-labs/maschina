import { useEffect, useRef, useState } from "react";
import type { PnlPoint } from "../lib/pnl.ts";
import { niceTicks, softPath } from "../lib/smooth-line.ts";

/**
 * Realized profit over time: one soft line, a point for every sale, the zero line dashed so a loss reads
 * as below it. Drawn here rather than in a trading chart: profit is a running total, not prices, so it has
 * no candles and no reason for corners. Colors come from the theme, so it follows light and dark.
 *
 * It moves the way a trading chart does. Scroll on it to zoom in time around the pointer, scroll sideways
 * or with shift to move along it, scroll on the scale at the right to zoom the money, scroll on the times
 * along the bottom to move, drag to move, and double click to see it all again.
 */

const PAD = { top: 12, right: 56, bottom: 22, left: 4 };
/** How much one notch of the wheel zooms. */
const NOTCH = 1.0018;

const dollars = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
const when = (seconds: number) =>
	new Date(seconds * 1000).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

type View = { from: number; to: number; low?: number; high?: number };

export function PnlChartView({ points }: { points: PnlPoint[] }) {
	const holder = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [view, setView] = useState<View | undefined>(undefined);
	useEffect(() => {
		const element = holder.current;
		if (!element) return;
		const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
		measure();
		const watch = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
		watch?.observe(element);
		return () => watch?.disconnect();
	}, []);

	// Two sales in the same second are one moment, so the later one stands.
	const series = [
		...new Map(points.map((point) => [point.time, Number(point.value) / 1_000_000])),
	].map(([time, value]) => ({ time, value }));
	const first = series[0]?.time ?? 0;
	const last = series.at(-1)?.time ?? first;
	const { width, height } = size;
	const plotW = Math.max(width - PAD.left - PAD.right, 1);
	const plotH = Math.max(height - PAD.top - PAD.bottom, 1);

	// What is in view: all of it until someone zooms or moves.
	const from = view?.from ?? first;
	const to = view?.to ?? (last > first ? last : first + 1);
	const span = to - from || 1;
	const seen = series.filter((each) => each.time >= from && each.time <= to);
	const values = (seen.length ? seen : series).map((each) => each.value);
	const autoLow = Math.min(0, ...values);
	const autoHigh = Math.max(0, ...values);
	const low = view?.low ?? autoLow;
	const high = view?.high ?? autoHigh;
	const room = high - low || 1;
	const x = (time: number) =>
		PAD.left + (series.length === 1 ? plotW : ((time - from) / span) * plotW);
	const y = (value: number) => PAD.top + (1 - (value - low) / room) * plotH;

	// The wheel, read by hand so the page does not scroll while the chart is being worked.
	const live = useRef({ from, to, low, high, plotW, plotH, first, last });
	live.current = { from, to, low, high, plotW, plotH, first, last };
	useEffect(() => {
		const element = holder.current;
		if (!element) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const box = element.getBoundingClientRect();
			const at = { x: event.clientX - box.left, y: event.clientY - box.top };
			const now = live.current;
			const nowSpan = now.to - now.from || 1;
			const onScale = at.x > PAD.left + now.plotW;
			const onTimes = at.y > PAD.top + now.plotH;
			const sideways = event.shiftKey ? event.deltaY : event.deltaX;
			if (onScale) {
				// The money scale: zoom about its middle.
				const factor = NOTCH ** event.deltaY;
				const middle = (now.low + now.high) / 2;
				const half = ((now.high - now.low) / 2) * factor || 0.5;
				setView({ from: now.from, to: now.to, low: middle - half, high: middle + half });
				return;
			}
			if (onTimes || Math.abs(sideways) > Math.abs(event.deltaY)) {
				// Along the bottom, or sideways: move in time.
				const step = ((onTimes ? event.deltaY : sideways) / now.plotW) * nowSpan;
				setView((was) => ({ ...was, from: now.from + step, to: now.to + step }));
				return;
			}
			// On the chart: zoom in time around the pointer.
			const factor = NOTCH ** event.deltaY;
			const pivot = now.from + ((at.x - PAD.left) / now.plotW) * nowSpan;
			const nextSpan = Math.max(
				60,
				Math.min(nowSpan * factor, (now.last - now.first) * 4 || 86_400),
			);
			const share = (pivot - now.from) / nowSpan;
			setView((was) => ({
				...was,
				from: pivot - share * nextSpan,
				to: pivot + (1 - share) * nextSpan,
			}));
		};
		element.addEventListener("wheel", onWheel, { passive: false });
		return () => element.removeEventListener("wheel", onWheel);
	}, []);

	// Dragging moves in time, and in money too once the money scale has been zoomed by hand.
	const drag = useRef<{ x: number; y: number; view: View } | undefined>(undefined);

	if (points.length === 0) {
		return (
			<p className="text-[11px] text-neutral-500 tracking-[0.1em]">
				NO SALES YET · THE LINE STARTS AT THE FIRST ONE
			</p>
		);
	}

	const line = series.map((each) => ({ x: x(each.time), y: y(each.value) }));
	const end = series.at(-1);

	return (
		<div
			ref={holder}
			data-testid="pnl-chart"
			role="application"
			aria-label="Profit chart. Scroll to zoom, drag or use the arrow keys to move, plus and minus to zoom, zero to see it all."
			// biome-ignore lint/a11y/noNoninteractiveTabindex: an application region is interactive, and takes the keys below
			tabIndex={0}
			onKeyDown={(event) => {
				const nowSpan = to - from || 1;
				const keep = view?.low === undefined ? {} : { low, high };
				if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
					const step = (event.key === "ArrowLeft" ? -0.1 : 0.1) * nowSpan;
					setView({ from: from + step, to: to + step, ...keep });
				} else if (event.key === "+" || event.key === "=" || event.key === "-") {
					const factor = event.key === "-" ? 1.25 : 0.8;
					const middle = (from + to) / 2;
					setView({
						from: middle - (nowSpan * factor) / 2,
						to: middle + (nowSpan * factor) / 2,
						...keep,
					});
				} else if (event.key === "0") setView(undefined);
				else return;
				event.preventDefault();
			}}
			className="relative h-64 w-full cursor-crosshair touch-none select-none text-(--chart) active:cursor-grabbing"
			onPointerDown={(event) => {
				drag.current = {
					x: event.clientX,
					y: event.clientY,
					view: { from, to, ...(view?.low === undefined ? {} : { low, high }) },
				};
				(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
			}}
			onPointerMove={(event) => {
				const started = drag.current;
				if (!started) return;
				const moved = ((event.clientX - started.x) / plotW) * (started.view.to - started.view.from);
				const next: View = { from: started.view.from - moved, to: started.view.to - moved };
				if (started.view.low !== undefined && started.view.high !== undefined) {
					const lifted =
						((event.clientY - started.y) / plotH) * (started.view.high - started.view.low);
					next.low = started.view.low + lifted;
					next.high = started.view.high + lifted;
				}
				setView(next);
			}}
			onPointerUp={() => {
				drag.current = undefined;
			}}
			onDoubleClick={() => setView(undefined)}
		>
			{width > 0 ? (
				<svg width={width} height={height} role="img" aria-label="Realized profit over time">
					<defs>
						<clipPath id="pnl-plot">
							<rect x={PAD.left} y={0} width={plotW} height={PAD.top + plotH + 1} />
						</clipPath>
					</defs>
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
					<g clipPath="url(#pnl-plot)">
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
							d={softPath(line)}
							fill="none"
							stroke="currentColor"
							strokeOpacity={0.9}
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						{end ? <circle cx={x(end.time)} cy={y(end.value)} r={2.5} fill="currentColor" /> : null}
					</g>
					<text x={PAD.left} y={height - 4} className="fill-neutral-500 font-mono text-[10px]">
						{when(from)}
					</text>
					<text
						x={PAD.left + plotW}
						y={height - 4}
						textAnchor="end"
						className="fill-neutral-500 font-mono text-[10px]"
					>
						{when(to)}
					</text>
				</svg>
			) : null}
			{end ? (
				<span className="pointer-events-none absolute top-0 left-1 font-mono text-[12px] text-neutral-100">
					{dollars(end.value)}
				</span>
			) : null}
		</div>
	);
}
