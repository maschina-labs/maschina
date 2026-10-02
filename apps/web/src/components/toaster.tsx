import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { preview } from "../lib/preview.ts";
import { type Toast, toast, useToasts } from "../lib/toasts.ts";

/**
 * Where toasts appear: in the open space to the right of the tiles, at the bottom, stacked with the
 * tiles' gap, newest at the bottom; above the dock on a phone. Each rises in softly and fades on its own. Solid, like the opened screens, so a line is readable over anything.
 */
export function Toaster() {
	const toasts = useToasts();
	// For trying the look while developing: ?toasts fires a few samples.
	useEffect(() => {
		if (preview("toasts") === undefined) return;
		const timers = [
			setTimeout(() => toast("Funded Range Finder"), 400),
			setTimeout(() => toast("Address copied"), 1400),
			setTimeout(() => toast("The wallet said no", "problem"), 2400),
		];
		return () => {
			for (const timer of timers) clearTimeout(timer);
		};
	}, []);
	return (
		<div
			role="status"
			aria-live="polite"
			// Phone: across the bottom, above the dock. Wider: in the open space to the right of the tiles,
			// where the charms come in from: starting one tile gap past the grid's right edge, filling that
			// margin to the same gap from the screen's edge, stacked with the same gap, newest at the bottom.
			// Where that margin is too narrow to read in, it keeps at least 240px and reaches over the grid.
			className="pointer-events-none fixed inset-x-4 bottom-[calc(max(env(safe-area-inset-bottom),16px)+74px)] z-[70] flex flex-col items-stretch gap-2.5 md:right-2.5 md:bottom-6 md:left-[min(calc(50vw+(var(--u)*6+50px)/2+10px),calc(100vw-250px))] md:[--u:min(calc((86vw-50px)/6),calc((66vh-20px)/3))]"
		>
			{toasts.map((each) => (
				<Line key={each.id} toast={each} />
			))}
		</div>
	);
}

function Line({ toast: line }: { toast: Toast }) {
	const [shown, setShown] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(true));
		return () => cancelAnimationFrame(frame);
	}, []);
	const Icon = line.tone === "problem" ? WarningCircle : CheckCircle;
	return (
		<p
			className={`flex w-full items-center gap-3 bg-[oklch(0.17_0_0)] px-4 py-3 font-display text-[15px] text-neutral-100 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
		>
			<Icon
				size={18}
				weight="light"
				className={
					line.tone === "problem" ? "shrink-0 text-neutral-300" : "shrink-0 text-neutral-400"
				}
			/>
			{line.text}
		</p>
	);
}
