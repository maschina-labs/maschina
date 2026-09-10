/**
 * The window, reading the log.
 *
 * `ENVIRONMENT_PLAN` slice 1. The rawest possible view: events, newest first,
 * exactly as recorded. This is the one place in the environment where the record
 * is shown without interpretation, because everything else is a projection of it
 * and a projection that disagrees with this view is wrong.
 *
 * There is no placeholder data anywhere in this file. `01-PRINCIPLES` P4 rejects
 * milestones whose evidence is a screenshot, and invented rows in a viewer are
 * exactly that. An empty log renders as an empty log.
 *
 * Losing the control plane is not an empty state. A window that goes blank when
 * the connection drops is indistinguishable from one showing that nothing has
 * happened, and those two mean opposite things.
 */

import { useCallback, useEffect, useState } from "react";
import type { WireEvent } from "../preload/index.ts";

/** How often to ask again. Slice 5 replaces this with something the server pushes. */
const REFRESH_MS = 2_000;

type Connection =
	| { readonly state: "connecting" }
	| { readonly state: "connected" }
	| { readonly state: "lost"; readonly problem: string };

export function App() {
	const [events, setEvents] = useState<readonly WireEvent[]>([]);
	const [connection, setConnection] = useState<Connection>({ state: "connecting" });
	const [selected, setSelected] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) {
			setConnection({
				state: "lost",
				problem: "The preload bridge did not load, so this window can reach nothing.",
			});
			return;
		}
		const result = await bridge.log.events({ limit: 200 });
		if (result.ok) {
			setEvents(result.value);
			setConnection({ state: "connected" });
		} else {
			// The events already on screen stay there. They were true when they
			// arrived and losing the connection does not make them false.
			setConnection({ state: "lost", problem: result.problem });
		}
	}, []);

	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), REFRESH_MS);
		return () => clearInterval(timer);
	}, [refresh]);

	const newestFirst = [...events].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1));

	return (
		<div className="shell">
			<header className="titlebar">
				<span className="titlebar__mark">Maschina</span>
				<span className="titlebar__stage">the log</span>
			</header>

			<main className="body">
				{connection.state === "lost" && <Lost problem={connection.problem} />}
				{newestFirst.length === 0 && connection.state === "connected" ? (
					<Empty />
				) : (
					<Log events={newestFirst} selected={selected} onSelect={setSelected} />
				)}
			</main>

			<Status connection={connection} count={events.length} />
		</div>
	);
}

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

function Empty() {
	return (
		<div className="empty empty--centred">
			<h1 className="empty__title">The log is empty</h1>
			<p className="empty__text">
				Nothing has been recorded yet. State an objective and it will appear here.
			</p>
			<div className="empty__next">maschina objective state</div>
		</div>
	);
}

function Log({
	events,
	selected,
	onSelect,
}: {
	readonly events: readonly WireEvent[];
	readonly selected: string | null;
	readonly onSelect: (id: string | null) => void;
}) {
	return (
		<table className="log">
			<thead>
				<tr>
					<th className="log__id">id</th>
					<th>recorded</th>
					<th>actor</th>
					<th>type</th>
					<th>objective</th>
				</tr>
			</thead>
			<tbody>
				{events.map((event) => {
					const open = selected === event.id;
					return <Row key={event.id} event={event} open={open} onSelect={onSelect} />;
				})}
			</tbody>
		</table>
	);
}

function Row({
	event,
	open,
	onSelect,
}: {
	readonly event: WireEvent;
	readonly open: boolean;
	readonly onSelect: (id: string | null) => void;
}) {
	return (
		<>
			<tr
				className={open ? "log__row log__row--open" : "log__row"}
				onClick={() => onSelect(open ? null : event.id)}
				// A row is a real control: it opens the payload. Keyboard reaches it
				// for the same reason a button does.
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onSelect(open ? null : event.id);
					}
				}}
				tabIndex={0}
			>
				<td className="log__id">{event.id}</td>
				<td className="log__time">{when(event.recordedAt)}</td>
				<td className="log__actor">{event.actor}</td>
				<td>
					<span className="log__type">{event.type}</span>
				</td>
				<td className="log__objective">{short(event.objective)}</td>
			</tr>
			{open && (
				<tr className="log__payload">
					<td colSpan={5}>
						<pre>{JSON.stringify(event.payload, null, 2)}</pre>
					</td>
				</tr>
			)}
		</>
	);
}

function Status({
	connection,
	count,
}: {
	readonly connection: Connection;
	readonly count: number;
}) {
	const label =
		connection.state === "connected"
			? "reading the log"
			: connection.state === "connecting"
				? "connecting"
				: "not connected";
	return (
		<footer className="statusbar">
			<span>
				<span className={`statusbar__dot statusbar__dot--${connection.state}`} />
				{label}
			</span>
			<span>
				{count} event{count === 1 ? "" : "s"}
			</span>
			<span style={{ marginLeft: "auto" }}>electron {window.maschina?.version ?? "-"}</span>
		</footer>
	);
}

/** Local time, to the second. The log records instants; people read clocks. */
function when(iso: string): string {
	const at = new Date(iso);
	return Number.isNaN(at.getTime()) ? iso : at.toLocaleTimeString();
}

/** Objective ids are long and the first segment is enough to recognise one. */
function short(objective: string | null): string {
	if (objective === null) return "";
	return objective.startsWith("obj_") ? objective.slice(0, 12) : objective;
}
