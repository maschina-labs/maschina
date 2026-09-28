import { Link } from "@tanstack/react-router";
import { GLASS } from "./glass.ts";

/**
 * The first time someone arrives: three steps to their first machine at work, each ticked as it is done.
 * Paper first, because it costs nothing and teaches everything. Gone once they have a machine.
 */
export function FirstRun({ connected, hasMachine }: { connected: boolean; hasMachine: boolean }) {
	if (hasMachine) return null;
	const steps: [string, string, boolean][] = [
		["CONNECT YOUR WALLET", "SIGN ONE MESSAGE. NOTHING IS SENT AND NOTHING IS SPENT.", connected],
		["MAKE A PAPER MACHINE", "FREE. IT TRADES AGAINST REAL PRICES AND MOVES NO MONEY.", false],
		["WATCH IT WORK", "ITS BAND ON THE CHART, EVERY DECISION AND WHY, AS IT HAPPENS.", false],
	];
	const next = steps.findIndex(([, , done]) => !done);
	return (
		<section aria-label="Getting started" className={`flex flex-col gap-4 p-5 ${GLASS}`}>
			<h2 className="text-[10.5px] text-neutral-500 tracking-[0.14em]">START HERE</h2>
			<ol className="grid gap-4 md:grid-cols-3">
				{steps.map(([title, detail, done], index) => (
					<li key={title} className="flex flex-col gap-2">
						<span
							className={`text-[10.5px] tabular-nums tracking-[0.14em] ${done ? "text-neutral-600" : "text-neutral-500"}`}
						>
							{done ? "DONE" : `STEP ${index + 1}`}
						</span>
						<span
							className={`text-[12px] tracking-[0.12em] ${done ? "text-neutral-500 line-through" : index === next ? "text-neutral-100" : "text-neutral-400"}`}
						>
							{title}
						</span>
						<span className="text-[10.5px] text-neutral-500 leading-relaxed tracking-[0.08em]">
							{detail}
						</span>
						{index === 1 && index === next ? (
							<Link
								to="/new"
								className="self-start border border-white/30 px-3 py-1.5 text-[10.5px] text-neutral-100 tracking-[0.12em] hover:bg-white/[0.06]"
							>
								MAKE ONE →
							</Link>
						) : null}
					</li>
				))}
			</ol>
		</section>
	);
}
