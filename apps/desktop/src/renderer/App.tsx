/**
 * The shell: which view is showing, and whether the log is being read.
 *
 * There is no placeholder data anywhere in this application. `01-PRINCIPLES` P4
 * rejects milestones whose evidence is a screenshot, and invented rows in a
 * viewer are exactly that.
 */

import { useCallback, useState } from "react";
import { Log } from "./Log.tsx";
import { Objectives } from "./Objectives.tsx";

type View = "objectives" | "log";

export function App() {
	const [view, setView] = useState<View>("objectives");
	const [problem, setProblem] = useState<string | null>(null);
	const [count, setCount] = useState(0);

	// Stable, so the effects reporting into them do not fire on every render.
	const reportProblem = useCallback((p: string | null) => setProblem(p), []);
	const reportCount = useCallback((n: number) => setCount(n), []);

	return (
		<div className="shell">
			<header className="titlebar">
				<span className="titlebar__mark">Maschina</span>
				<nav className="tabs">
					<Tab now={view} is="objectives" onPick={setView}>
						objectives
					</Tab>
					<Tab now={view} is="log" onPick={setView}>
						log
					</Tab>
				</nav>
			</header>

			<main className="body">
				{problem !== null && <Lost problem={problem} />}
				{view === "objectives" ? (
					<Objectives onProblem={reportProblem} />
				) : (
					<Log onProblem={reportProblem} onCount={reportCount} />
				)}
			</main>

			<footer className="statusbar">
				<span>
					<span
						className={`statusbar__dot statusbar__dot--${problem === null ? "connected" : "lost"}`}
					/>
					{problem === null ? "reading the log" : "not connected"}
				</span>
				{view === "log" && (
					<span>
						{count} event{count === 1 ? "" : "s"}
					</span>
				)}
				<span style={{ marginLeft: "auto" }}>electron {window.maschina?.version ?? "-"}</span>
			</footer>
		</div>
	);
}

function Tab({
	now,
	is,
	onPick,
	children,
}: {
	readonly now: View;
	readonly is: View;
	readonly onPick: (v: View) => void;
	readonly children: string;
}) {
	return (
		<button
			type="button"
			className={now === is ? "tab tab--now" : "tab"}
			onClick={() => onPick(is)}
		>
			{children}
		</button>
	);
}

/**
 * Losing the control plane is a notice, not an empty state. A window that goes
 * blank when the connection drops is indistinguishable from one showing that
 * nothing has happened, and those two mean opposite things.
 */
function Lost({ problem }: { readonly problem: string }) {
	return (
		<div className="notice">
			<strong className="notice__title">Not reading the log</strong>
			<p className="notice__text">{problem}</p>
			<p className="notice__text notice__text--dim">
				Anything below was true when it was read. It is not being updated.
			</p>
		</div>
	);
}
