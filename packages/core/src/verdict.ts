/**
 * Verdicts. `09-EVALUATION` §5.
 *
 * **Evaluation does not return a boolean.** It returns one verdict per
 * criterion, because "is it done" is almost never a single fact, and collapsing
 * it into one loses the thing a worker needs most: which parts are finished and
 * which remain.
 *
 * The hard rule here is `indeterminate`. It is a first-class result and must
 * never be rounded. Rounding it to satisfied is how false completion enters a
 * permanent record. Rounding it to not satisfied throws away real work. P8 says
 * ambiguity blocks, and this is the place it is most tempting not to.
 */

/** What evaluating one criterion concluded. */
export type VerdictResult = "satisfied" | "not_satisfied" | "indeterminate";

export interface Verdict {
	readonly criterionId: string;
	readonly result: VerdictResult;
	/** Artifact hashes, event ids, command output. What makes this checkable. */
	readonly evidence: readonly string[];
	/** Which verification strength was actually used, `09-EVALUATION` §3. */
	readonly method: string;
	readonly notes: string;
}

/**
 * What the verdicts add up to, and what the objective becomes.
 *
 * `partial` is normal, not a failure: most non-trivial objectives satisfy some
 * criteria before all of them, and per-criterion verdicts are what make the
 * remaining work visible instead of restarting from nothing.
 */
export type Rollup = "accomplished" | "partial" | "not_accomplished" | "indeterminate";

export type ObjectiveOutcome = "accomplished" | "active" | "failed" | "suspended";

/**
 * Roll per-criterion verdicts into one answer. `09-EVALUATION` §5.
 *
 * Order matters and is the whole function:
 *
 *   Nothing to judge is not success. An empty contract satisfies vacuously,
 *   which is exactly the shape a Goodhart failure takes, so it is indeterminate.
 *
 *   One indeterminate beats every satisfied. Not being able to tell about any
 *   part of an objective means not being able to tell about the objective, and
 *   any other order silently lets an unknown be outvoted by the parts that
 *   happened to be checkable.
 *
 *   One unsatisfiable criterion fails the whole thing, because a contract is a
 *   conjunction. It was frozen at admission precisely so this cannot be
 *   negotiated afterwards.
 */
export function rollup(verdicts: readonly Verdict[]): Rollup {
	if (verdicts.length === 0) return "indeterminate";
	if (verdicts.some((v) => v.result === "indeterminate")) return "indeterminate";
	if (verdicts.some((v) => v.result === "not_satisfied")) {
		return verdicts.every((v) => v.result === "not_satisfied") ? "not_accomplished" : "partial";
	}
	return "accomplished";
}

/**
 * What the objective becomes. `09-EVALUATION` §5.
 *
 * `partial` leaves the objective active with work remaining rather than failing
 * it, and `indeterminate` suspends for a human rather than resolving itself in
 * whichever direction is convenient.
 */
export function outcomeFor(result: Rollup): ObjectiveOutcome {
	switch (result) {
		case "accomplished":
			return "accomplished";
		case "partial":
			return "active";
		case "not_accomplished":
			return "failed";
		case "indeterminate":
			return "suspended";
	}
}

/** Criteria still to satisfy, so a worker knows what is left rather than redoing it all. */
export function remaining(verdicts: readonly Verdict[]): string[] {
	return verdicts.filter((v) => v.result !== "satisfied").map((v) => v.criterionId);
}
