/**
 * Objectives, and one objective in detail. `ENVIRONMENT_PLAN` slice 2.
 *
 * The contract is shown as what it is: **frozen at admission**. It is rendered
 * read-only with its hash beside it, because a surface that makes a contract look
 * editable is teaching the wrong thing. `09-EVALUATION` §2 and invariant 16:
 * changing a contract creates a new objective, it does not amend this one.
 *
 * Which criteria are satisfied comes from `criterion.satisfied` events, recorded
 * at the step that satisfied them. Not recomputed at the end, and not taken from
 * anything a worker said about itself.
 */

import { useCallback, useMemo, useState } from "react";
import type { WireEvent } from "../preload/index.ts";
import { useReading } from "./useLog.ts";

export function Objectives({ onProblem }: { readonly onProblem: (p: string | null) => void }) {
	const [openId, setOpenId] = useState<string | null>(null);

	const readList = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.objectives.list();
	}, []);

	const { value, connection } = useReading(readList);
	const objectives = value ?? [];

	onProblem(connection.state === "lost" ? connection.problem : null);

	if (objectives.length === 0 && connection.state === "connected") {
		return (
			<div className="empty empty--centred">
				<h1 className="empty__title">No objectives yet</h1>
				<p className="empty__text">
					An objective needs a contract saying what done means. Without one it is not admitted,
					which is the point.
				</p>
				<div className="empty__next">
					maschina objective state --statement ... --contract ...
				</div>
			</div>
		);
	}

	return (
		<div className="split">
			<ul className="objectives">
				{objectives.map((objective) => (
					<li key={objective.id}>
						<button
							type="button"
							className={openId === objective.id ? "objective objective--open" : "objective"}
							onClick={() => setOpenId(objective.id === openId ? null : objective.id)}
						>
							<span className={`state state--${objective.state}`}>{objective.state}</span>
							<span className="objective__statement">{objective.statement}</span>
							<span className="objective__id">{objective.id.slice(0, 12)}</span>
						</button>
					</li>
				))}
			</ul>
			{openId !== null && <Detail id={openId} />}
		</div>
	);
}

function Detail({ id }: { readonly id: string }) {
	const readOne = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.objectives.one(id);
	}, [id]);

	const readEvents = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.log.events({ objective: id, limit: 500 });
	}, [id]);

	const { value: objective } = useReading(readOne);
	const { value: events } = useReading(readEvents);

	// When each criterion was met, from the events that recorded it happening.
	const satisfied = useMemo(() => whenSatisfied(events ?? []), [events]);

	if (objective === null) return <aside className="detail">reading...</aside>;

	return (
		<aside className="detail">
			<h2 className="detail__statement">{objective.statement}</h2>

			<dl className="facts">
				<dt>state</dt>
				<dd>
					<span className={`state state--${objective.state}`}>{objective.state}</span>
				</dd>
				<dt>origin</dt>
				<dd>{objective.origin}</dd>
				<dt>contract</dt>
				<dd title="Recorded at admission. Never recomputed from a later contract.">
					{objective.contractHash === null ? (
						<span className="dim">not admitted, so nothing is frozen</span>
					) : (
						<>
							<span className="frozen">frozen</span> {objective.contractHash.slice(0, 16)}
						</>
					)}
				</dd>
				{objective.refusedBecause ? (
					<>
						<dt>refused</dt>
						<dd className="refused">{objective.refusedBecause}</dd>
					</>
				) : null}
			</dl>

			<h3 className="detail__heading">
				Criteria
				<span className="detail__count">
					{objective.contract.criteria.filter((c) => satisfied.has(c.id)).length} of{" "}
					{objective.contract.criteria.length} met
				</span>
			</h3>

			<ul className="criteria">
				{objective.contract.criteria.map((criterion) => {
					const met = satisfied.get(criterion.id);
					return (
						<li key={criterion.id} className={met ? "criterion criterion--met" : "criterion"}>
							<div className="criterion__head">
								<span className="criterion__mark">{met ? "met" : "open"}</span>
								<span className="criterion__id">{criterion.id}</span>
								<span className={`strength strength--${criterion.strength}`}>
									{criterion.strength}
								</span>
							</div>
							<p className="criterion__text">{criterion.criterion}</p>
							<p className="criterion__how">
								<span className="dim">checked by</span> {criterion.verifyBy}
							</p>
							{met ? (
								<p className="criterion__when">
									<span className="dim">met at</span> event {met}
								</p>
							) : null}
						</li>
					);
				})}
			</ul>

			{objective.contract.nonGoals.length > 0 && (
				<Listing title="Not this" items={objective.contract.nonGoals} />
			)}
			{objective.contract.failureConditions.length > 0 && (
				<Listing title="Counts as failed" items={objective.contract.failureConditions} />
			)}

			<h3 className="detail__heading">
				What happened
				<span className="detail__count">{(events ?? []).length} events</span>
			</h3>
			<ol className="history">
				{[...(events ?? [])].reverse().map((event) => (
					<li key={event.id}>
						<span className="history__type">{event.type}</span>
						<span className="history__actor">{event.actor}</span>
					</li>
				))}
			</ol>
		</aside>
	);
}

function Listing({
	title,
	items,
}: {
	readonly title: string;
	readonly items: readonly string[];
}) {
	return (
		<>
			<h3 className="detail__heading">{title}</h3>
			<ul className="plain">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</>
	);
}

/**
 * Which criteria are met, and at which event.
 *
 * From `criterion.satisfied` events rather than from a final verdict, so a
 * criterion met at step two reads as met at step two. `09-EVALUATION` §5.
 */
function whenSatisfied(events: readonly WireEvent[]): Map<string, string> {
	const met = new Map<string, string>();
	for (const event of events) {
		if (event.type !== "criterion.satisfied") continue;
		const id = event.payload.criterionId;
		if (typeof id === "string" && !met.has(id)) met.set(id, event.id);
	}
	return met;
}
