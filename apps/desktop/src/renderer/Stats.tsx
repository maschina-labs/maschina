/**
 * What has been done. `ENVIRONMENT_PLAN` slice 8.
 *
 * Every number here is a count of events. Nothing is stored, nothing is
 * estimated, and deleting every projection and rebuilding leaves it identical,
 * because there is nothing to rebuild: it is a fold over the log computed on
 * request.
 *
 * **This is not the front door.** `08-ENVIRONMENT` §1: a surface fails when it
 * shows state you have to go elsewhere to act on. The queue is what needs a
 * person. This is what happened, and it is behind the queue on purpose.
 *
 * **No worker sees any of it.** A worker that can see a number it is judged on
 * optimises for the number, which is the null-step problem in a costume.
 */

import { useCallback, useEffect } from "react";
import { useReading } from "./useLog.ts";

/**
 * A level is the work that has been done, not a number that goes up on its own.
 *
 * Criteria satisfied, because `03-RUNTIME` §8 says plainly that criteria being
 * met is the one measure a worker cannot game by narrating. Counting steps or
 * events would reward activity; this rewards finishing something.
 *
 * Each level costs a little more than the last, which is the whole trick of the
 * genre and costs nothing to be honest about.
 */
function levelFrom(criteriaSatisfied: number): { level: number; into: number; needs: number } {
	let level = 1;
	let remaining = criteriaSatisfied;
	let cost = 3;
	while (remaining >= cost) {
		remaining -= cost;
		level++;
		cost = Math.round(cost * 1.6);
	}
	return { level, into: remaining, needs: cost };
}

export function Stats({ onProblem }: { readonly onProblem: (p: string | null) => void }) {
	const read = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.stats.read();
	}, []);

	const { value, connection } = useReading(read);

	const problem = connection.state === "lost" ? connection.problem : null;
	useEffect(() => onProblem(problem), [onProblem, problem]);

	if (value === null) return <div className="empty empty--centred">reading...</div>;

	const rank = levelFrom(value.criteriaSatisfied);

	return (
		<div className="stats">
			<header className="rank">
				<div className="rank__level">
					<span className="rank__number">{rank.level}</span>
					<span className="dim">level</span>
				</div>
				<div className="rank__bar">
					<div
						className="rank__fill"
						style={{ width: `${Math.round((rank.into / rank.needs) * 100)}%` }}
					/>
				</div>
				<span className="dim">
					{rank.into} of {rank.needs} criteria to the next
				</span>
			</header>

			<Heatmap days={value.days} streak={value.streak} />

			<h3 className="detail__heading">Done</h3>
			<Counts
				of={[
					["objectives stated", value.objectivesStated],
					["objectives accomplished", value.objectivesAccomplished],
					["criteria satisfied", value.criteriaSatisfied],
					["effects on the world", value.effects],
				]}
			/>

			<h3 className="detail__heading">Asked and answered</h3>
			<Counts
				of={[
					["questions asked of you", value.questionsAsked],
					["you answered", value.questionsAnswered],
					["approvals you gave", value.approvalsGiven],
				]}
			/>

			<h3 className="detail__heading">
				Refused and survived
				<span className="detail__count">not failures</span>
			</h3>
			<Counts
				of={[
					["times authority was refused", value.denials],
					["steps that got nowhere", value.nullSteps],
				]}
			/>
			<p className="cost__note">
				A denial is a boundary holding, and a null step is how a worker notices it is stuck.
				Both are the system working.
			</p>

			<h3 className="detail__heading">
				Spent
				<span className="detail__count">${(value.spent / 1_000_000).toFixed(6)}</span>
			</h3>
			<p className="cost__note">
				List value, from settlements. Nothing here was billed: no key exists.
			</p>
		</div>
	);
}

function Counts({ of }: { readonly of: readonly (readonly [string, number])[] }) {
	return (
		<table className="cost">
			<tbody>
				{of.map(([label, count]) => (
					<tr key={label}>
						<td>{label}</td>
						<td className="cost__amount">{count}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

/**
 * The last fifteen weeks, one square per day.
 *
 * Empty days are drawn rather than skipped, because the gaps are the point: a
 * heatmap with the quiet days removed is a bar chart that lies about time.
 */
function Heatmap({
	days,
	streak,
}: {
	readonly days: readonly { date: string; events: number }[];
	readonly streak: number;
}) {
	const counts = new Map(days.map((d) => [d.date, d.events]));
	const busiest = Math.max(1, ...days.map((d) => d.events));

	const squares: { date: string; events: number }[] = [];
	const cursor = new Date();
	cursor.setDate(cursor.getDate() - 104);
	for (let i = 0; i < 105; i++) {
		const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
		squares.push({ date, events: counts.get(date) ?? 0 });
		cursor.setDate(cursor.getDate() + 1);
	}

	return (
		<>
			<h3 className="detail__heading">
				Every day
				<span className="detail__count">
					{streak} day{streak === 1 ? "" : "s"} in a row
				</span>
			</h3>
			<div className="heatmap">
				{squares.map((square) => (
					<span
						key={square.date}
						className="heatmap__day"
						title={`${square.date}: ${square.events} event${square.events === 1 ? "" : "s"}`}
						style={{
							opacity: square.events === 0 ? 0.07 : 0.25 + 0.75 * (square.events / busiest),
						}}
					/>
				))}
			</div>
		</>
	);
}
