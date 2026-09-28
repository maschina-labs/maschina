import { ColorType, createChart, LineSeries, LineStyle } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { PnlPoint } from "../lib/pnl.ts";

/**
 * Realised profit over time: one thin line floating on the fog, a point for every sale, the zero line
 * dashed so a loss reads as below it. Colours are rgba because the chart library only reads rgb and hex.
 */

const LINE = "rgba(236, 236, 236, 0.9)"; // oklch(0.94 0 0)
const DIAL = "rgba(163, 163, 163, 0.75)"; // oklch(0.72 0 0)
const GRID = "rgba(255, 255, 255, 0.045)";

export function PnlChartView({ points }: { points: PnlPoint[] }) {
	const holder = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!holder.current || points.length === 0) return;
		const chart = createChart(holder.current, {
			autoSize: true,
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: DIAL,
				fontFamily: '"Geist Mono", ui-monospace, monospace',
				fontSize: 11,
				attributionLogo: true,
			},
			grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false, timeVisible: true, fixLeftEdge: true, fixRightEdge: true },
		});
		const line = chart.addSeries(LineSeries, {
			color: LINE,
			lineWidth: 1,
			priceLineVisible: false,
		});
		line.createPriceLine({
			price: 0,
			color: GRID,
			lineStyle: LineStyle.Dashed,
			lineWidth: 1,
			axisLabelVisible: false,
		});
		// Two sales in the same second would be one point to the chart, so the later one stands.
		const byTime = new Map(points.map((point) => [point.time, Number(point.value) / 1_000_000]));
		line.setData([...byTime].map(([time, value]) => ({ time, value })) as never);
		chart.timeScale().fitContent();
		return () => chart.remove();
	}, [points]);

	if (points.length === 0) {
		return (
			<p className="text-[11px] text-neutral-500 tracking-[0.1em]">
				NO SALES YET · THE LINE STARTS AT THE FIRST ONE
			</p>
		);
	}
	return <div ref={holder} data-testid="pnl-chart" className="h-64 w-full" />;
}
