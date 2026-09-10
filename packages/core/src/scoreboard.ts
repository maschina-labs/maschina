/**
 * What has been done, counted.
 *
 * A fold over the log and nothing else. `02-CORE` §7: every projection is
 * derived, deletable and rebuildable, which means a scoreboard cannot drift from
 * the record because it has no record of its own. Delete it and rebuild it and
 * the numbers are the same, or the fold is wrong.
 *
 * **No worker ever sees any of this.** A worker that can see a number it is
 * judged on will optimise for the number, which is the null-step problem wearing
 * a costume: it rewards looking productive. `03-RUNTIME` §8 already admits that
 * counting steps is gameable, and a visible score would hand a worker the
 * scoreboard as well as the game. This module is imported by the control plane
 * and by the window, and by nothing on a worker's path.
 *
 * It is also not the front door. `08-ENVIRONMENT` §1: a surface fails when it
 * shows state you have to go elsewhere to act on. The queue is what needs a
 * person; this is what happened.
 */

/** One day, and what happened on it. The shape a heatmap is drawn from. */
export interface Day {
	/** `YYYY-MM-DD`, in the reader's own timezone rather than the log's. */
	readonly date: string;
	readonly events: number;
}

export interface Scoreboard {
	/** Every event, which is the only number here that counts everything. */
	readonly events: number;
	readonly objectivesStated: number;
	readonly objectivesAccomplished: number;
	readonly criteriaSatisfied: number;
	/** Effects that reached the world, not decisions about them. */
	readonly effects: number;
	/** Recorded as prominently as uses, so counted as prominently too. */
	readonly denials: number;
	readonly approvalsGiven: number;
	readonly questionsAsked: number;
	readonly questionsAnswered: number;
	/** Steps that got nowhere. Survived rather than avoided: they are normal. */
	readonly nullSteps: number;
	/** Micro-dollars of list value, settled. */
	readonly spent: number;
	readonly days: readonly Day[];
	/** How many days in a row have something on them, counting back from the last. */
	readonly streak: number;
}

interface Countable {
	readonly type: string;
	readonly recordedAt: Date;
	readonly payload: Record<string, unknown>;
}

/**
 * Fold the log into a scoreboard.
 *
 * Every number here is a count of events of a type. Nothing is inferred, nothing
 * is estimated, and nothing is stored: run it twice on the same log and it gives
 * the same answer twice.
 */
export function scoreboard(events: readonly Countable[], now: Date = new Date()): Scoreboard {
	let objectivesStated = 0;
	let objectivesAccomplished = 0;
	let criteriaSatisfied = 0;
	let effects = 0;
	let denials = 0;
	let approvalsGiven = 0;
	let questionsAsked = 0;
	let questionsAnswered = 0;
	let nullSteps = 0;
	let spent = 0;

	const byDay = new Map<string, number>();

	for (const event of events) {
		byDay.set(dayOf(event.recordedAt), (byDay.get(dayOf(event.recordedAt)) ?? 0) + 1);

		switch (event.type) {
			case "objective.stated":
				objectivesStated++;
				break;
			case "objective.evaluated":
				if (event.payload.outcome === "accomplished") objectivesAccomplished++;
				break;
			case "criterion.satisfied":
				criteriaSatisfied++;
				break;
			case "effect.outcome":
				effects++;
				break;
			case "capability.denied":
				denials++;
				break;
			case "capability.approved":
				approvalsGiven++;
				break;
			case "worker.suspended":
				// A clock resolves an `until`. Only a person resolves a question, so
				// only a question is something that was asked of anybody.
				if (event.payload.kind === "question") questionsAsked++;
				break;
			case "worker.resumed":
				if (typeof event.payload.answeredBy === "string") questionsAnswered++;
				break;
			case "step.completed":
				if (isNull(event.payload)) nullSteps++;
				break;
			case "capability.settled":
				spent += typeof event.payload.amount === "number" ? event.payload.amount : 0;
				break;
			default:
				break;
		}
	}

	const days = [...byDay.entries()]
		.map(([date, count]) => ({ date, events: count }))
		.sort((a, b) => a.date.localeCompare(b.date));

	return {
		events: events.length,
		objectivesStated,
		objectivesAccomplished,
		criteriaSatisfied,
		effects,
		denials,
		approvalsGiven,
		questionsAsked,
		questionsAnswered,
		nullSteps,
		spent,
		days,
		streak: streakOf(byDay, now),
	};
}

/**
 * Local date, not UTC.
 *
 * A heatmap is read by a person looking at their own week. Bucketing by UTC puts
 * an evening's work on tomorrow for anybody west of Greenwich, which makes the
 * squares wrong for exactly the people most likely to be looking at them.
 */
function dayOf(at: Date): string {
	const year = at.getFullYear();
	const month = String(at.getMonth() + 1).padStart(2, "0");
	const day = String(at.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Consecutive days with something on them, counting back from today.
 *
 * Today not having anything on it yet does not break a streak: the day is not
 * over. Yesterday having nothing does.
 */
function streakOf(byDay: ReadonlyMap<string, number>, now: Date): number {
	let streak = 0;
	const cursor = new Date(now);

	if (!byDay.has(dayOf(cursor))) cursor.setDate(cursor.getDate() - 1);

	while (byDay.has(dayOf(cursor))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

/** The same rule the runtime uses, applied to a recorded step rather than a live one. */
function isNull(payload: Record<string, unknown>): boolean {
	const empty = (key: string) =>
		!Array.isArray(payload[key]) || (payload[key] as []).length === 0;
	return (
		empty("artifacts") &&
		empty("observations") &&
		empty("satisfied") &&
		!payload.changedTheWorld
	);
}
