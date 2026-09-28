import { type FinderForm, finderReady } from "../lib/finder-form.ts";
import { numberFrom } from "../lib/range-form.ts";
import { GLASS, GLASS_ACTIVE } from "./glass.ts";
import { PriceChart } from "./price-chart.tsx";
import { SliderRow, TypeRow } from "./slider-row.tsx";

/**
 * The Range Finder's own controls (D-089, D-093): a band that follows the price and a floor under every
 * buy. After the floor it rests an hour and starts again around wherever the price is by then.
 */

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

function Choice<T extends string | number>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: [T, string][];
	onChange: (value: T) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className={`pt-2 ${LABEL}`}>{label}</span>
			<fieldset className="flex gap-1.5">
				<legend className="sr-only">{label}</legend>
				{options.map(([option, text]) => (
					<button
						key={String(option)}
						type="button"
						aria-pressed={option === value}
						onClick={() => onChange(option)}
						className={`h-9 flex-1 text-[11px] tracking-[0.12em] ${option === value ? `text-neutral-100 ${GLASS_ACTIVE}` : `text-neutral-500 ${GLASS}`}`}
					>
						{text}
					</button>
				))}
			</fieldset>
		</div>
	);
}

export function RangeFinderForm({
	form,
	price,
	paper,
	creating,
	error,
	onChange,
	onCreate,
}: {
	form: FinderForm;
	price: number | undefined;
	paper: boolean;
	creating: boolean;
	error?: string | undefined;
	onChange: (form: FinderForm) => void;
	onCreate: () => void;
}) {
	const half = form.bandPct / 200;
	const float = numberFrom(form.float);
	const levels =
		price === undefined
			? []
			: [
					{ price: price * (1 + half), label: "FOLLOW" },
					{ price: price * (1 - half), label: "BUY" },
					{ price: price * (1 - half) * (1 - form.floorPct / 100), label: "FLOOR" },
				];
	return (
		<div className="flex flex-col gap-1.5">
			<TypeRow label="NAME" value={form.name} onChange={(name) => onChange({ ...form, name })} />
			<TypeRow
				label="FLOAT"
				value={form.float}
				onChange={(value) => onChange({ ...form, float: value })}
				suffix="USDC"
			/>
			<SliderRow
				label="BAND WIDTH"
				value={form.bandPct}
				min={1}
				max={5}
				step={0.1}
				shown={`${form.bandPct.toFixed(1)}%`}
				onChange={(bandPct) => onChange({ ...form, bandPct })}
			/>
			<Choice
				label="FLOOR UNDER EVERY BUY"
				value={form.floorPct}
				options={[
					[8, "8%"],
					[5, "5%"],
					[3, "3%"],
				]}
				onChange={(floorPct) => onChange({ ...form, floorPct })}
			/>
			<p className={`pt-2 ${LABEL}`}>
				BUYS A {(form.bandPct / 2).toFixed(1)}% DIP · SELLS {form.bandPct.toFixed(1)}% ABOVE WHAT IT
				PAID · FOLLOWS THE PRICE UP · RESTS AN HOUR AFTER THE FLOOR
				{Number.isFinite(float) && float > 0 ? ` · EACH BUY ${(float - 0.25).toFixed(2)} USDC` : ""}
			</p>
			<div className="h-48 pt-2">
				<PriceChart interval="15m" history={120} levels={levels} />
			</div>
			{error ? (
				<p role="alert" className="text-[11px] text-neutral-300">
					{error}
				</p>
			) : null}
			<button
				type="button"
				disabled={!finderReady(form) || creating}
				onClick={onCreate}
				className="mt-2 h-10 border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
			>
				{creating
					? "MAKING ITS WALLET"
					: paper
						? "CREATE PAPER RANGE FINDER"
						: "CREATE RANGE FINDER"}
			</button>
		</div>
	);
}
