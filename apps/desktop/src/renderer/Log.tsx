/**
 * The log, exactly as recorded. `ENVIRONMENT_PLAN` slice 1.
 *
 * The one place in the environment where the record is shown without
 * interpretation. Everything else is a projection of it, and a projection that
 * disagrees with this view is the projection that is wrong.
 */

import { useCallback, useState } from "react";
import type { WireEvent } from "../preload/index.ts";
import { useReading } from "./useLog.ts";

export function Log({
	onProblem,
	onCount,
}: {
	readonly onProblem: (p: string | null) => void;
	readonly onCount: (n: number) => void;
}) {
	const [selected, setSelected] = useState<string | null>(null);

	const read = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.log.events({ limit: 200 });
	}, []);

	const { value, connection } = useReading(read);
	const events = value ?? [];

	onProblem(connection.state === "lost" ? connection.problem : null);
	onCount(events.length);

	if (events.length === 0 && connection.state === "connected") {
		return (
			<div className="empty empty--centred">
				<h1 className="empty__title">The log is empty</h1>
				<p className="empty__text">Nothing has been recorded yet.</p>
				<div className="empty__next">maschina event append --actor you --type note.made</div>
			</div>
		);
	}

	const newestFirst = [...events].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1));

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
				{newestFirst.map((event) => (
					<Row
						key={event.id}
						event={event}
						open={selected === event.id}
						onSelect={setSelected}
					/>
				))}
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
	const toggle = () => onSelect(open ? null : event.id);
	return (
		<>
			<tr
				className={open ? "log__row log__row--open" : "log__row"}
				onClick={toggle}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						toggle();
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
