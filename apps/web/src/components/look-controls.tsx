import { Moon, Sun } from "@phosphor-icons/react";
import {
	type Choice,
	FIELDS,
	MODES,
	MOTIONS,
	PALETTES,
	setChoice,
	useTheme,
} from "../lib/theme.ts";

/**
 * How the screen looks, as four switches that do not depend on each other: dark or light, a dynamic or
 * still sky, what moves behind the glass, and whose colors. The same controls in the sidebar and in
 * Settings, so the two can never disagree.
 */

function Row<T extends string | boolean>({
	name,
	options,
	chosen,
	onPick,
	columns,
}: {
	name: string;
	options: { id: T; name: string }[];
	chosen: T;
	onPick: (id: T) => void;
	columns: 2 | 3;
}) {
	return (
		<fieldset aria-label={name} className="flex flex-col gap-1.5">
			<legend className="mb-1.5 text-[12px] text-neutral-500">{name}</legend>
			<div className={`grid gap-1 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
				{options.map((each) => (
					<button
						key={String(each.id)}
						type="button"
						aria-pressed={chosen === each.id}
						onClick={() => onPick(each.id)}
						className={`py-2 text-[13px] transition-colors ${chosen === each.id ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
					>
						{each.name}
					</button>
				))}
			</div>
		</fieldset>
	);
}

const SKIES: { id: boolean; name: string }[] = [
	{ id: true, name: "Dynamic" },
	{ id: false, name: "Still" },
];

export function LookControls({ title = true }: { title?: boolean }) {
	const { choice, mode } = useTheme();
	const pick =
		<K extends keyof Choice>(key: K) =>
		(value: Choice[K]) =>
			setChoice({ [key]: value });
	return (
		<div className="flex flex-col gap-4">
			{title ? (
				<span className="flex items-center gap-4 text-[15px] text-neutral-100">
					{mode === "light" ? <Sun size={20} weight="light" /> : <Moon size={20} weight="light" />}
					Theme
				</span>
			) : null}
			<Row name="Mode" options={MODES} chosen={choice.mode} onPick={pick("mode")} columns={3} />
			<Row
				name="Sky"
				options={SKIES}
				chosen={choice.dynamic}
				onPick={pick("dynamic")}
				columns={2}
			/>
			<Row
				name="Background"
				options={FIELDS}
				chosen={choice.field}
				onPick={pick("field")}
				columns={2}
			/>
			<Row
				name="Motion"
				options={MOTIONS}
				chosen={choice.motion}
				onPick={pick("motion")}
				columns={3}
			/>
			<Row
				name="Palette"
				options={PALETTES}
				chosen={choice.palette}
				onPick={pick("palette")}
				columns={3}
			/>
			<p className="text-[12px] text-neutral-500 leading-relaxed">
				Dynamic brings the weather where you are. With System, the colors follow the sun too.
			</p>
		</div>
	);
}
