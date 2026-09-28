import { GLASS } from "./glass.ts";

/**
 * A glass bar you drag to set a number: the lighter fill is the value, with a hairline at its edge, the
 * label on the left and the value on the right. From Ash's reference of slider rows over moss. A real
 * range input sits invisibly over the bar, so it works by keyboard and with a screen reader too.
 */

/** How far along its range a value sits, 0 to 1, held to the bar. */
export function fillOf(value: number, min: number, max: number): number {
	if (!(max > min) || !Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function SliderRow({
	label,
	value,
	min,
	max,
	step,
	shown,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	/** The value as it reads on the bar. */
	shown: string;
	onChange: (value: number) => void;
}) {
	const fill = fillOf(value, min, max) * 100;
	return (
		<div className={`relative h-12 select-none overflow-hidden ${GLASS}`}>
			<div
				aria-hidden="true"
				className="absolute inset-y-0 left-0 bg-white/[0.07]"
				style={{ width: `${fill}%` }}
			/>
			<div
				aria-hidden="true"
				className="absolute inset-y-2 w-px bg-white/60"
				style={{ left: `${fill}%` }}
			/>
			<div className="pointer-events-none relative flex h-full items-center justify-between px-4 text-[12px] tracking-[0.12em]">
				<span className="text-neutral-400">{label}</span>
				<span className="text-neutral-100 tabular-nums">{shown}</span>
			</div>
			<input
				type="range"
				aria-label={label}
				aria-valuetext={shown}
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
			/>
		</div>
	);
}

/** A glass bar you type into, for the values that are words or exact amounts. */
export function TypeRow({
	label,
	value,
	onChange,
	suffix,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	suffix?: string;
}) {
	return (
		<label
			className={`flex h-12 items-center justify-between gap-4 px-4 text-[12px] tracking-[0.12em] ${GLASS}`}
		>
			<span className="shrink-0 text-neutral-400">{label}</span>
			<span className="flex min-w-0 items-center gap-2">
				<input
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="min-w-0 bg-transparent text-right text-neutral-100 uppercase tabular-nums outline-none"
				/>
				{suffix ? <span className="text-neutral-500">{suffix}</span> : null}
			</span>
		</label>
	);
}
