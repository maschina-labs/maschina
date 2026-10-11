import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { softPath } from "../lib/smooth-line.ts";
import { Odometer } from "./odometer.tsx";

/**
 * A number tile, in one of three layouts, read like a heads up display: the number big, its unit small
 * beside it, how it moved, and where it has been.
 *
 *   spark: number top left, its change, a sparkline through the middle, the label at the foot.
 *   top:   number top left, its change under it, the label at the foot.
 *   label: the label up top, the number anchored at the foot with its change.
 *
 * The layout is a setting of the tile, not of its data, so a tile can be switched between them.
 */

export type StatLayout = "spark" | "top" | "label";

export type Delta = { text: string; up: boolean; over?: string };

/** How a series moved over its last stretch, as a signed amount. */
export function deltaOf(
	series: number[],
	format: (value: number) => string,
	over?: string,
): Delta | undefined {
	if (series.length < 2) return undefined;
	const change = (series.at(-1) ?? 0) - (series[0] ?? 0);
	return {
		text: `${change >= 0 ? "+" : "-"}${format(Math.abs(change))}`,
		up: change >= 0,
		...(over ? { over } : {}),
	};
}

function Spark({ series }: { series: number[] }) {
	const width = 100;
	const height = 32;
	const low = Math.min(...series);
	const high = Math.max(...series);
	const room = high - low || 1;
	const points = series.map((value, index) => ({
		x: (index / Math.max(series.length - 1, 1)) * width,
		y: 2 + (1 - (value - low) / room) * (height - 4),
	}));
	const line = softPath(points);
	const end = points.at(-1);
	return (
		<div className="relative h-full w-full">
			<svg
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="none"
				aria-hidden="true"
				className="h-full w-full overflow-visible text-(--chart)"
			>
				<defs>
					<linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0" stopColor="currentColor" stopOpacity="0.14" />
						<stop offset="1" stopColor="currentColor" stopOpacity="0" />
					</linearGradient>
				</defs>
				<path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#spark-fill)" />
				<path
					d={line}
					fill="none"
					stroke="currentColor"
					strokeOpacity={0.85}
					strokeWidth={1.25}
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			{/* The latest point, drawn outside the stretched drawing so it stays round. */}
			{end ? (
				<span
					className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--chart)"
					style={{ left: `${(end.x / width) * 100}%`, top: `${(end.y / height) * 100}%` }}
				/>
			) : null}
		</div>
	);
}

function Change({ delta }: { delta: Delta }) {
	const Arrow = delta.up ? CaretUp : CaretDown;
	return (
		<span className="flex items-center gap-1 font-mono text-[12px] text-neutral-300 tabular-nums">
			<Arrow
				size={11}
				weight="fill"
				className={delta.up ? "text-neutral-100" : "text-neutral-500"}
			/>
			{delta.text}
			{delta.over ? <span className="text-neutral-500">· {delta.over}</span> : null}
		</span>
	);
}

export function Stat({
	label,
	value,
	unit,
	delta,
	series,
	layout = series && series.length > 1 ? "spark" : "top",
}: {
	label: string;
	value: string;
	unit?: string;
	delta?: Delta | undefined;
	series?: number[] | undefined;
	layout?: StatLayout;
}) {
	const number = (
		<span className="flex items-baseline gap-1.5">
			<span
				className="font-display text-[clamp(22px,13cqw,44px)] text-neutral-100 leading-none whitespace-nowrap"
				style={
					value.length > 7
						? {
								fontSize: `min(clamp(22px, 13cqw, 44px), calc((100cqw - 64px) / ${value.length * 0.58}))`,
							}
						: undefined
				}
			>
				<Odometer value={value} />
			</span>
			{unit ? <span className="text-[13px] text-neutral-500">{unit}</span> : null}
		</span>
	);
	const name = <span className="text-[13px] text-neutral-500">{label}</span>;

	if (layout === "label")
		return (
			<div data-layout="label" className="flex h-full flex-col justify-between p-4">
				{name}
				<div className="flex flex-col gap-1.5">
					{number}
					{delta ? <Change delta={delta} /> : null}
				</div>
			</div>
		);

	return (
		<div data-layout={layout} className="flex h-full flex-col p-4">
			<div className="flex flex-col gap-1.5">
				{number}
				{delta ? <Change delta={delta} /> : null}
			</div>
			{layout === "spark" && series && series.length > 1 ? (
				<div className="my-3 min-h-0 flex-1">
					<Spark series={series} />
				</div>
			) : (
				<div className="flex-1" />
			)}
			{name}
		</div>
	);
}
