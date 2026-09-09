/**
 * The shell. Step 1 of the working environment: a window, and an honest empty
 * state.
 *
 * There is deliberately no placeholder data here. 01-PRINCIPLES P4 rejects
 * milestones whose evidence is a screenshot, and fake rows in a viewer are
 * exactly that. The next step connects this to the real event log.
 */

export function App() {
	return (
		<div className="shell">
			<header className="titlebar">
				<span className="titlebar__mark">Maschina</span>
				<span className="titlebar__stage">Stage 0</span>
			</header>

			<main className="body">
				<div className="empty">
					<h1 className="empty__title">Not connected to the log</h1>
					<p className="empty__text">
						This window is the working environment shell. It reads nothing yet.
					</p>
					<div className="empty__next">next: read the event log</div>
				</div>
			</main>

			<footer className="statusbar">
				<span>
					<span className="statusbar__dot" />
					no connection
				</span>
				<span>0 events</span>
				<span style={{ marginLeft: "auto" }}>electron {window.maschina?.version ?? "-"}</span>
			</footer>
		</div>
	);
}
