/**
 * Whether a worker is getting anywhere. `03-RUNTIME` §8.
 *
 * "A worker that never terminates is the characteristic failure of autonomous
 * systems. Budget bounds it eventually, but eventually, expensively is not good
 * enough."
 *
 * **A null step produces no new artifact, no new observation, and no change in
 * the world.** A run of them means the worker is stuck regardless of how
 * confident it sounds, and that is the signal: not elapsed time, not a step
 * count, not cost. A worker taking a slow careful step is working. A worker
 * taking three fast steps that change nothing is not.
 *
 * **The document calls this its weakest section, and it is right.** Null-step
 * counting is a crude proxy that a worker could satisfy while accomplishing
 * nothing: emit an observation each step and the counter never trips. It is kept
 * because it catches the common case, a worker circling, and because a crude
 * signal that fires is worth more than a sophisticated one that does not exist.
 * `09-EVALUATION` holds the real answer, and criteria being satisfied is the
 * measure that cannot be gamed by narrating.
 */

/** What one step actually produced. */
export interface StepOutcome {
	/** Artifact references. A file written, a commit pushed. */
	readonly artifacts: readonly string[];
	/** Something learned about the world that was not known before. */
	readonly observations: readonly string[];
	/** Whether anything outside Maschina is different afterwards. */
	readonly changedTheWorld: boolean;
	/** Criteria this step satisfied, if any. The measure that cannot be narrated. */
	readonly satisfied: readonly string[];
}

/**
 * A step that got nowhere.
 *
 * Deliberately not "a step that failed". A step that tried something and
 * recorded that it did not work produced an observation, and that is progress:
 * the worker knows something it did not know before.
 */
export function isNullStep(step: StepOutcome): boolean {
	return (
		step.artifacts.length === 0 &&
		step.observations.length === 0 &&
		step.satisfied.length === 0 &&
		!step.changedTheWorld
	);
}

export interface Progress {
	readonly steps: number;
	/** How many in a row have got nowhere. Resets on any progress. */
	readonly consecutiveNulls: number;
	/** Which criteria are satisfied, in the order they were. */
	readonly satisfied: readonly string[];
	readonly artifacts: readonly string[];
}

export function foldProgress(steps: readonly StepOutcome[]): Progress {
	let consecutiveNulls = 0;
	const satisfied: string[] = [];
	const artifacts: string[] = [];

	for (const step of steps) {
		if (isNullStep(step)) {
			consecutiveNulls++;
		} else {
			// Any progress at all resets it. A worker that got somewhere once is
			// not stuck, however long it circled before.
			consecutiveNulls = 0;
		}
		for (const id of step.satisfied) if (!satisfied.includes(id)) satisfied.push(id);
		artifacts.push(...step.artifacts);
	}

	return { steps: steps.length, consecutiveNulls, satisfied, artifacts };
}

/**
 * How many null steps in a row before stopping.
 *
 * `03-RUNTIME` §8: "N starts small, perhaps three." Three, then, and it is a
 * count of steps that changed nothing rather than a count of steps.
 */
export const NULL_STEP_LIMIT = 3;

export interface Stall {
	readonly stuck: boolean;
	/** What a person is being asked. Specific, and answerable in one reply. */
	readonly question: string;
	readonly reason: string;
}

/**
 * Is it stuck, and what should somebody be asked?
 *
 * `STAGE_1_PLAN` criterion 3 wants a **specific answerable question**, not a
 * report that something failed. "The worker is stuck" is a status. "Three steps
 * produced nothing, criteria c2 and c3 are unmet, and the last thing it tried
 * was X: is the contract wrong or is something missing" is a question with an
 * answer.
 */
export function stalled(
	progress: Progress,
	criteria: readonly string[],
	lastAttempt: string,
	limit = NULL_STEP_LIMIT,
): Stall {
	if (progress.consecutiveNulls < limit) {
		return { stuck: false, question: "", reason: "" };
	}

	const remaining = criteria.filter((id) => !progress.satisfied.includes(id));
	const done =
		progress.satisfied.length === 0
			? "nothing yet"
			: `${progress.satisfied.length} of ${criteria.length} (${progress.satisfied.join(", ")})`;

	return {
		stuck: true,
		reason:
			`${progress.consecutiveNulls} steps in a row produced no artifact, no observation ` +
			`and no change in the world`,
		question:
			`After ${progress.steps} steps this has satisfied ${done}, and ${remaining.length} ` +
			`criteri${remaining.length === 1 ? "on" : "a"} remain: ${remaining.join(", ") || "none"}. ` +
			`The last thing it tried was: ${lastAttempt}. ` +
			"Is something missing that it needs, or is a criterion not achievable as written?",
	};
}
