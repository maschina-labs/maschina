/**
 * The Objective primitive. 02-CORE §3.1.
 *
 * "A stated intention, held by the system, with an explicit contract for what
 * would constitute its completion."
 *
 * An Objective is not a task and not a prompt. It outlives the worker that
 * failed at it, it can be reassigned, and it is the thing a human owns and
 * evaluation judges. That is why it has an identity independent of any process
 * working on it.
 *
 * Nothing here is stored as a row. An Objective is a projection over the event
 * log (02-CORE §7), folded from the events in `db/objective.ts`.
 */

/**
 * How strongly a criterion is verified. 09-EVALUATION §3, strongest first.
 *
 * Self-assessment is deliberately absent. A worker reporting that it is done is
 * never the basis for marking an objective accomplished, so it is not something
 * a contract can ask for.
 */
export type VerificationStrength = "mechanical" | "differential" | "independent" | "human";

/**
 * One independently checkable condition.
 *
 * "Make the code better" is not admissible. "An independent reviewer judges the
 * code clearer, and here is what they will look at" is. A criterion that is
 * vague about which kind it is gets rejected at admission.
 */
export interface Criterion {
	/** Stable within the contract. Verdicts are recorded against this. */
	readonly id: string;
	/** The verifiable condition, in prose. */
	readonly criterion: string;
	/** How it is checked. A command, a query, a thing a reviewer looks at. */
	readonly verifyBy: string;
	readonly strength: VerificationStrength;
	/**
	 * What must exist to demonstrate this criterion.
	 *
	 * 09-EVALUATION §2 lists `evidence_required` at the contract level while
	 * describing it as "what must exist to demonstrate each criterion". Read
	 * literally those disagree, so it sits per-criterion here, which is the
	 * reading that makes it usable. Flagged as a documentation question rather
	 * than silently reinterpreted.
	 */
	readonly evidence: readonly string[];
}

/**
 * The completion contract. 09-EVALUATION §2.
 *
 * An objective without one cannot be admitted. If we cannot say what would count
 * as done, we are not ready to start.
 */
export interface Contract {
	/** At least one. An empty contract is not a contract. */
	readonly criteria: readonly Criterion[];
	/**
	 * Explicitly out of scope. Prevents the scope expansion that happens when a
	 * capable worker notices adjacent problems, and gives an evaluator grounds
	 * to reject work that solved the wrong problem well.
	 */
	readonly nonGoals: readonly string[];
	/** What would mean this cannot be accomplished at all. */
	readonly failureConditions: readonly string[];
}

/** Bounds on the pursuit. 02-CORE §3.1. */
export interface Constraints {
	readonly maxSteps?: number;
	readonly wallClockSeconds?: number;
	readonly maxSpendUsd?: number;
}

/**
 * 02-CORE §3.1.
 *
 * `suspended` is not failure. It is the correct state when authority is
 * exhausted, an ambiguous effect blocks progress, or a human intervenes.
 *
 * `evaluating` and `accomplished` are separate on purpose. Execution completing
 * is not the same as the objective being achieved, and collapsing them is the
 * mistake 09-EVALUATION exists to prevent.
 */
export type ObjectiveState =
	| "stated"
	| "rejected"
	| "admitted"
	| "active"
	| "suspended"
	| "evaluating"
	| "accomplished"
	| "failed"
	| "abandoned";

/** An objective as folded from the log. */
export interface Objective {
	readonly id: string;
	readonly statement: string;
	readonly contract: Contract;
	readonly constraints: Constraints;
	/** Who or what created it. */
	readonly origin: string;
	/** Objectives form a tree. Null at the root. */
	readonly parent: string | null;
	readonly state: ObjectiveState;
	/**
	 * The contract hash, recorded at admission and never recomputed from a
	 * later contract. Null until admitted.
	 *
	 * This is the anti-Goodhart control: a worker that can edit its own success
	 * criteria will eventually edit them to match what it built, with an
	 * entirely reasonable-sounding justification. A frozen hash means the target
	 * cannot move.
	 */
	readonly contractHash: string | null;
	/** Why admission was refused. Null unless state is `rejected`. */
	readonly rejectedReason: string | null;
}
