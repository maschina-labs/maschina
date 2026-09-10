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
 * counting is a crude proxy. It is kept because it catches the common case, a
 * worker circling, and because a crude signal that fires is worth more than a
 * sophisticated one that does not exist. `09-EVALUATION` holds the real answer,
 * and criteria being satisfied is the measure that cannot be gamed by narrating.
 *
 * **An observation only counts if it is new, and the fold decides that, not the
 * worker.** The first live run of criterion 3 failed here. Asked eight times to
 * do something impossible, a real model refused eight times and worded the
 * refusal differently each time. Every step therefore reported an observation,
 * the counter reset every step, and the worker ran to its ceiling without ever
 * stopping to ask. Exact-match dedupe in the worker did nothing, and trusting a
 * worker's own claim to have learned something is the same mistake as trusting
 * reported command output over the world (invariant 17). So novelty is computed
 * here, from what is already in the log, by comparing wording.
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
 *
 * `priorObservations` is everything already observed on this objective. Pass it
 * and a restatement of something already known stops counting as learning. Left
 * out, any observation counts, which is the behaviour that failed live.
 */
export function isNullStep(
	step: StepOutcome,
	priorObservations: readonly string[] = [],
): boolean {
	const learned = step.observations.filter((o) => isNewObservation(o, priorObservations));
	return (
		step.artifacts.length === 0 &&
		learned.length === 0 &&
		step.satisfied.length === 0 &&
		!step.changedTheWorld
	);
}

/**
 * How much wording two observations share, counted symmetrically.
 *
 * Shared words over the union of both, so a short sentence and a long one are
 * compared on equal terms. An earlier version divided by the newer observation
 * alone, which made any short observation look like a restatement of a long one:
 * "the history has 3 commits and none is a release" scored 0.60 against a
 * refusal that shares only the words history, commits and release. Measured
 * against real observations the asymmetric version does not separate at all,
 * while this one separates cleanly.
 *
 * It compares words, not meaning. Two genuinely different findings that share
 * vocabulary look similar to it. That is why it decides only whether a step
 * counts toward a stall, which ends in a question to a person, and never
 * anything on its own.
 */
export function wordOverlap(a: string, b: string): number {
	const words = (text: string) =>
		new Set(
			text
				.toLowerCase()
				.split(/[^a-z0-9]+/)
				.filter((w) => w.length > 3),
		);
	const left = words(a);
	const right = words(b);
	let shared = 0;
	for (const word of left) if (right.has(word)) shared++;
	const union = left.size + right.size - shared;
	return union === 0 ? 0 : shared / union;
}

/**
 * Above this much shared wording, an observation is a restatement.
 *
 * Measured, not guessed. Live runs of criterion 3 asked a model to document a
 * release process that does not exist, producing 18 distinct refusals alongside
 * 22 observations that genuinely said different things. Scored pairwise:
 *
 *   restatements      153 pairs, 0.21 to 0.93
 *   different things  396 pairs, 0.00 to 0.21
 *
 * At 0.30, 144 of the 153 restatements are caught and none of the 396 different
 * observations is mistaken for one. Missing a few matters less than it looks,
 * because a step is compared against every earlier observation and only has to
 * resemble one of them.
 *
 * The sample is one model refusing one kind of impossible request. Every
 * observation is in the log, so this can be re-measured on real history rather
 * than argued about.
 */
export const RESTATEMENT = 0.3;

/** Does this say anything that has not already been said? */
export function isNewObservation(
	observation: string,
	priors: readonly string[],
	threshold = RESTATEMENT,
): boolean {
	return !priors.some((prior) => wordOverlap(observation, prior) >= threshold);
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
	const observed: string[] = [];

	for (const step of steps) {
		if (isNullStep(step, observed)) {
			consecutiveNulls++;
		} else {
			// Any progress at all resets it. A worker that got somewhere once is
			// not stuck, however long it circled before.
			consecutiveNulls = 0;
		}
		for (const id of step.satisfied) if (!satisfied.includes(id)) satisfied.push(id);
		artifacts.push(...step.artifacts);
		for (const o of step.observations) if (isNewObservation(o, observed)) observed.push(o);
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
