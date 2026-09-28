import type { Suggestion } from "../lib/suggestions.ts";
import { GLASS } from "./glass.ts";

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

/** The manager's suggestions, each for you to apply or dismiss. Applying waits for confirm and signing. */
export function ManagerView({
	suggestions,
	onDismiss,
}: {
	suggestions: Suggestion[];
	onDismiss: (id: string) => void;
}) {
	return (
		<div className="flex max-w-[720px] flex-col gap-6">
			<p className="text-[11.5px] text-neutral-400 leading-relaxed tracking-[0.08em]">
				THE MANAGER LOOKS OVER YOUR MACHINES AND SUGGESTS WHAT TO CHANGE. IT NEVER CHANGES ANYTHING
				ITSELF: YOU DECIDE, AND ANYTHING THAT TOUCHES MONEY IS SIGNED BY YOU. FOR NOW THE
				SUGGESTIONS COME FROM PLAIN RULES; THE AI TAKES OVER WRITING THEM LATER.
			</p>
			{suggestions.length === 0 ? <p className={LABEL}>NOTHING TO SUGGEST RIGHT NOW</p> : null}
			<ol className="flex flex-col gap-1.5">
				{suggestions.map((suggestion) => (
					<li key={suggestion.id} className={`flex flex-col gap-3 p-4 ${GLASS}`}>
						<span className={LABEL}>{suggestion.machine}</span>
						<span className="text-[12.5px] text-neutral-100 tracking-[0.1em]">
							{suggestion.title}
						</span>
						<span className="text-[11px] text-neutral-400 tracking-[0.08em]">
							{suggestion.detail}
						</span>
						<div className="flex gap-1.5">
							<button
								type="button"
								disabled
								className="border border-white/25 px-3 py-1.5 text-[10.5px] text-neutral-100 tracking-[0.12em] disabled:opacity-40"
							>
								APPLY
							</button>
							<button
								type="button"
								onClick={() => onDismiss(suggestion.id)}
								className="border border-white/10 px-3 py-1.5 text-[10.5px] text-neutral-400 tracking-[0.12em] hover:text-neutral-100"
							>
								DISMISS
							</button>
						</div>
					</li>
				))}
			</ol>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				APPLYING A SUGGESTION ARRIVES WITH THE BACKEND PASS
			</p>
		</div>
	);
}
