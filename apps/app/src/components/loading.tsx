/**
 * Waiting, in the ruler's language: a row of ticks lighting up one after another. It says what it is
 * waiting for, so a screen reader hears that too.
 */
export function Loading({ what }: { what: string }) {
	return (
		<div role="status" className="flex items-center gap-3">
			<div aria-hidden="true" className="flex items-end gap-[3px]">
				{Array.from({ length: 12 }, (_, index) => (
					<span
						// The ticks never reorder, so their place is their identity.
						key={index}
						className="block h-3 w-px animate-[tick_1.2s_ease-in-out_infinite] bg-white/15"
						style={{ animationDelay: `${index * 0.1}s` }}
					/>
				))}
			</div>
			<span className="text-[10.5px] text-neutral-500 tracking-[0.14em]">{what}</span>
		</div>
	);
}

/** Halted: the kill switch is engaged, and nothing acts until it is released. Shown to everyone. */
export function HaltBanner({ reason }: { reason: string }) {
	return (
		<div
			role="alert"
			className="flex items-center justify-center gap-3 bg-neutral-100 px-4 py-2 text-[11px] text-neutral-950 tracking-[0.14em]"
		>
			<span className="font-semibold">HALTED</span>
			<span>NO MACHINE WILL ACT UNTIL THIS IS LIFTED · {reason.toUpperCase()}</span>
		</div>
	);
}
