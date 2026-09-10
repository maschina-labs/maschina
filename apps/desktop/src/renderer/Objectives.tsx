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

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WireEvaluation, WireEvent } from "../preload/index.ts";
import { State } from "./State.tsx";
import { useReading } from "./useLog.ts";

export function Objectives({ onProblem }: { readonly onProblem: (p: string | null) => void }) {
	const [openId, setOpenId] = useState<string | null>(null);
	const [stating, setStating] = useState(false);

	const readList = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.objectives.list();
	}, []);

	const { value, connection } = useReading(readList);
	const objectives = value ?? [];

	// Telling the parent has to happen after the render, not during it. React
	// refuses a state update in another component while this one is rendering,
	// and the whole view went blank rather than saying so.
	const problem = connection.state === "lost" ? connection.problem : null;
	useEffect(() => onProblem(problem), [onProblem, problem]);

	if (stating) {
		return (
			<State
				onStated={(id) => {
					setStating(false);
					setOpenId(id);
				}}
			/>
		);
	}

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
				<li>
					<button
						type="button"
						className="objective objective--new"
						onClick={() => setStating(true)}
					>
						<span className="dim">+</span>
						<span className="objective__statement">state an objective</span>
						<span />
					</button>
				</li>
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

	const readVerdicts = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.objectives.evaluations(id);
	}, [id]);

	const readCost = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.objectives.cost(id);
	}, [id]);

	const { value: objective } = useReading(readOne);
	const { value: events } = useReading(readEvents);
	const { value: judged } = useReading(readVerdicts);
	const { value: spent } = useReading(readCost);

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

			{(judged ?? []).length > 0 && <Judged evaluations={judged ?? []} />}

			{(spent ?? []).length > 0 && (
				<>
					<h3 className="detail__heading">
						What it cost
						<span className="detail__count">
							{money((spent ?? []).reduce((sum, line) => sum + line.settled, 0))}
						</span>
					</h3>
					<table className="cost">
						<tbody>
							{(spent ?? []).map((line) => (
								<tr key={line.resource}>
									<td>{line.resource}</td>
									<td className="dim">
										{line.calls} call{line.calls === 1 ? "" : "s"}
									</td>
									<td className="cost__amount">{money(line.settled)}</td>
								</tr>
							))}
						</tbody>
					</table>
					<p className="cost__note">
						Read from what was settled, not from anything a worker reported about itself.
					</p>
				</>
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

/**
 * What somebody judged, and on what evidence.
 *
 * The evidence is shown because a verdict that does not say what it was checked
 * against cannot be audited later, and the method is shown because
 * `09-EVALUATION` §3 ranks evidence: mechanical, independent and judgement are
 * not the same claim.
 *
 * The evaluator is named. `09-EVALUATION` §4 forbids a worker judging its own
 * objective, and showing who judged is how a person sees that it held.
 */
function Judged({ evaluations }: { readonly evaluations: readonly WireEvaluation[] }) {
	return (
		<>
			{evaluations.map((evaluation) => (
				<div key={`${evaluation.evaluator}-${evaluation.contractHash}`}>
					<h3 className="detail__heading">
						Judged {evaluation.outcome}
						<span className="detail__count">by {evaluation.evaluator}</span>
					</h3>
					<ul className="criteria">
						{evaluation.verdicts.map((verdict) => (
							<li
								key={verdict.criterionId}
								className={
									verdict.result === "satisfied" ? "criterion criterion--met" : "criterion"
								}
							>
								<div className="criterion__head">
									<span className="criterion__mark">{verdict.result}</span>
									<span className="criterion__id">{verdict.criterionId}</span>
									<span className={`strength strength--${verdict.method}`}>
										{verdict.method}
									</span>
								</div>
								{verdict.notes !== "" && <p className="criterion__text">{verdict.notes}</p>}
								{verdict.evidence.length > 0 && (
									<p className="criterion__how">
										<span className="dim">checked against</span> {verdict.evidence.join(", ")}
									</p>
								)}
							</li>
						))}
					</ul>
					{evaluation.remaining.length > 0 && (
						<p className="criterion__how">
							<span className="dim">still outstanding</span> {evaluation.remaining.join(", ")}
						</p>
					)}
				</div>
			))}
		</>
	);
}

/** Micro-dollars of list value, which is the unit the log records. */
function money(micro: number): string {
	return `$${(micro / 1_000_000).toFixed(6)}`;
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
