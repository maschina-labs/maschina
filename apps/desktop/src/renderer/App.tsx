/**
 * The shell: which view is showing, and whether the log is being read.
 *
 * There is no placeholder data anywhere in this application. `01-PRINCIPLES` P4
 * rejects milestones whose evidence is a screenshot, and invented rows in a
 * viewer are exactly that.
 */

import { Notice } from "@maschina/ui";
import { useCallback, useState } from "react";
import { Authority } from "./Authority.tsx";
import { Files } from "./Files.tsx";
import { Git } from "./Git.tsx";
import { Log } from "./Log.tsx";
import { Objectives } from "./Objectives.tsx";
import { Connect, useWhere } from "./Plane.tsx";
import { Queue } from "./Queue.tsx";
import { Stats } from "./Stats.tsx";
import { Stop } from "./Stop.tsx";
import { Terminal } from "./Terminal.tsx";

type View = "queue" | "objectives" | "authority" | "files" | "git" | "shell" | "log" | "stats";

export function App() {
	// The queue opens first. 08-ENVIRONMENT section 1: the primary surface is what
	// needs a person, not a view of what is happening.
	const [view, setView] = useState<View>("queue");
	const [problem, setProblem] = useState<string | null>(null);
	const [count, setCount] = useState(0);
	const { where, setWhere } = useWhere();
	const [changing, setChanging] = useState(false);

	// Null while it is still being read. Unset once it has been read and there is
	// nothing there, which is a different thing to show.
	const unset = where !== null && where.url === null;
	const dismiss = useCallback(() => setChanging(false), []);

	// Stable, so the effects reporting into them do not fire on every render.
	const reportProblem = useCallback((p: string | null) => setProblem(p), []);
	const reportCount = useCallback((n: number) => setCount(n), []);

	return (
		<div className="shell">
			<header className="titlebar">
				<span className="titlebar__mark">Maschina</span>
				<nav className="tabs">
					<Tab now={view} is="queue" onPick={setView}>
						needs you
					</Tab>
					<Tab now={view} is="objectives" onPick={setView}>
						objectives
					</Tab>
					<Tab now={view} is="authority" onPick={setView}>
						authority
					</Tab>
					<Tab now={view} is="files" onPick={setView}>
						files
					</Tab>
					<Tab now={view} is="git" onPick={setView}>
						git
					</Tab>
					<Tab now={view} is="shell" onPick={setView}>
						shell
					</Tab>
					<Tab now={view} is="log" onPick={setView}>
						log
					</Tab>
					<Tab now={view} is="stats" onPick={setView}>
						done
					</Tab>
				</nav>
				<Stop />
			</header>

			<main className="body">
				{where !== null && (unset || changing) && (
					<Connect
						where={where}
						onChanged={setWhere}
						onDismiss={changing ? dismiss : undefined}
					/>
				)}
				{problem !== null && !unset && <Lost problem={problem} />}
				{view === "queue" && <Queue onProblem={reportProblem} />}
				{view === "objectives" && <Objectives onProblem={reportProblem} />}
				{view === "log" && <Log onProblem={reportProblem} onCount={reportCount} />}
				{view === "authority" && <Authority onProblem={reportProblem} />}
				{view === "files" && <Files />}
				{view === "git" && <Git />}
				{view === "shell" && <Terminal cwd={null} />}
				{view === "stats" && <Stats onProblem={reportProblem} />}
			</main>

			<footer className="statusbar">
				<span>
					<span
						className={`statusbar__dot statusbar__dot--${unset ? "connecting" : problem === null ? "connected" : "lost"}`}
					/>
					{unset ? "no control plane" : problem === null ? "reading the log" : "not connected"}
				</span>
				{where !== null && where.url !== null && (
					<button type="button" className="statusbar__where" onClick={() => setChanging(true)}>
						{where.url}
					</button>
				)}
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
		<Notice title="Not reading the log" className="mx-4 mt-3">
			<p>{problem}</p>
			<p className="mt-1 text-ink-faint">
				Anything below was true when it was read. It is not being updated.
			</p>
		</Notice>
	);
}
