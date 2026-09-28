import { useState } from "react";
import { type Standing, WINDOWS, type Window } from "../lib/leaderboard.ts";
import { amount } from "../lib/machines.ts";

/** Top machines by what they realised, with the window to rank over. Yours for now. */
export function LeaderboardView({
	board,
	window,
	onWindow,
}: {
	board: Standing[];
	window: Window;
	onWindow: (window: Window) => void;
}) {
	return (
		<section aria-label="Top machines" className="flex flex-col gap-3">
			<div className="flex items-baseline justify-between gap-4">
				<h2 className="text-[10.5px] text-neutral-500 tracking-[0.14em]">TOP MACHINES</h2>
				<fieldset className="flex gap-4 text-[10.5px] tracking-[0.14em]">
					<legend className="sr-only">Over</legend>
					{(Object.keys(WINDOWS) as Window[]).map((each) => (
						<button
							key={each}
							type="button"
							aria-pressed={window === each}
							onClick={() => onWindow(each)}
							className={
								window === each ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
							}
						>
							{each}
						</button>
					))}
				</fieldset>
			</div>
			<ol className="flex flex-col">
				{board.map((standing, index) => (
					<li
						key={standing.machineId}
						className="grid grid-cols-[2rem_1fr_auto_auto] items-baseline gap-4 border-white/[0.06] border-b py-2 text-[11.5px] tabular-nums tracking-[0.1em]"
					>
						<span className="text-neutral-500">{String(index + 1).padStart(2, "0")}</span>
						<span className="truncate text-neutral-100">{standing.name.toUpperCase()}</span>
						<span className="text-[10px] text-neutral-600">
							{standing.paper ? "PAPER" : "LIVE"}
						</span>
						<span className="text-neutral-100">{amount(standing.realised.toString())}</span>
					</li>
				))}
			</ol>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				YOUR MACHINES FOR NOW · EVERY MACHINE ON MASCHINA WITH THE BACKEND PASS
			</p>
		</section>
	);
}

export function Leaderboard({ rank }: { rank: (window: Window) => Standing[] }) {
	const [window, setWindow] = useState<Window>("1W");
	return <LeaderboardView board={rank(window)} window={window} onWindow={setWindow} />;
}
