import { KIND_CARDS } from "../lib/kinds.ts";
import { GLASS, GLASS_ACTIVE } from "./glass.ts";

/** The kinds of machine, as square glass cards. The chosen one is brighter; kinds not ready say so. */
export function KindPicker({
	chosen,
	onChoose,
}: {
	chosen: string;
	onChoose: (kind: string) => void;
}) {
	return (
		<fieldset className="grid grid-cols-2 gap-1.5">
			<legend className="sr-only">{"Kind of machine"}</legend>
			{KIND_CARDS.map((card) => (
				<button
					key={card.id}
					type="button"
					aria-pressed={card.id === chosen}
					onClick={() => onChoose(card.id)}
					className={`flex min-h-20 flex-col items-start justify-between gap-2 p-3 text-left transition-colors ${
						card.id === chosen ? GLASS_ACTIVE : `${GLASS} hover:bg-white/[0.07]`
					}`}
				>
					<span className="flex w-full items-baseline justify-between gap-2 text-[11px] tracking-[0.12em]">
						<span className={card.id === chosen ? "text-neutral-100" : "text-neutral-300"}>
							{card.name}
						</span>
						{card.ready ? null : <span className="text-[9.5px] text-neutral-600">COMING</span>}
					</span>
					<span className="text-[10px] text-neutral-500 leading-relaxed tracking-[0.08em]">
						{card.earns}
					</span>
				</button>
			))}
		</fieldset>
	);
}

/** Two chips: paper, the free tutorial that moves no money, or live. */
export function PaperOrLive({
	paper,
	onChange,
}: {
	paper: boolean;
	onChange: (paper: boolean) => void;
}) {
	const chip = (on: boolean) =>
		`h-9 flex-1 text-[11px] tracking-[0.14em] transition-colors ${on ? `text-neutral-100 ${GLASS_ACTIVE}` : `text-neutral-500 ${GLASS}`}`;
	return (
		<fieldset className="flex gap-1.5">
			<legend className="sr-only">{"Paper or live"}</legend>
			<button
				type="button"
				aria-pressed={paper}
				onClick={() => onChange(true)}
				className={chip(paper)}
			>
				PAPER · FREE, NO MONEY MOVES
			</button>
			<button
				type="button"
				aria-pressed={!paper}
				onClick={() => onChange(false)}
				className={chip(!paper)}
			>
				LIVE · REAL MONEY
			</button>
		</fieldset>
	);
}
