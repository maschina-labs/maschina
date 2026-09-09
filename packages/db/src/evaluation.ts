/**
 * Recording verdicts. `09-EVALUATION` §5.
 *
 * Evaluation is not a special mechanism. A verdict is an event like anything
 * else, written by a worker holding an `evaluate` capability over one objective,
 * which the worker that executed can never hold (`09-EVALUATION` §4, enforced in
 * `capability.ts` at both grant and use).
 *
 * The rollup is pure and lives in `@maschina/core`, so what an objective becomes
 * is decided by a function anybody can read and nothing can quietly special-case
 * per objective.
 */

import type { ObjectiveOutcome, Verdict } from "@maschina/core";
import { outcomeFor, remaining, rollup } from "@maschina/core";
import type { Pool } from "pg";
import { append, epochFor, read } from "./log.ts";

export const OBJECTIVE_EVALUATED = "objective.evaluated";

export interface Evaluation {
	readonly objective: string;
	readonly evaluator: string;
	readonly verdicts: readonly Verdict[];
	readonly rollup: ReturnType<typeof rollup>;
	readonly outcome: ObjectiveOutcome;
	/** Criteria still to satisfy, so the executor knows what is left. */
	readonly remaining: readonly string[];
	/** The contract this judged, so a verdict cannot be read against a different one. */
	readonly contractHash: string;
}

/**
 * Record a verdict per criterion, and what the objective becomes.
 *
 * The contract hash is recorded with the verdicts deliberately. A contract is
 * frozen at admission (`09-EVALUATION` §2), and a verdict that did not say which
 * contract it judged could be read later against a different one, which is the
 * freeze defeated by filing rather than by argument.
 */
export async function recordEvaluation(
	pool: Pool,
	objective: string,
	evaluator: string,
	contractHash: string,
	verdicts: readonly Verdict[],
): Promise<Evaluation> {
	const result = rollup(verdicts);
	const evaluation: Evaluation = {
		objective,
		evaluator,
		verdicts,
		rollup: result,
		outcome: outcomeFor(result),
		remaining: remaining(verdicts),
		contractHash,
	};

	await append(pool, {
		actor: evaluator,
		objective,
		epoch: await epochFor(pool, evaluator),
		type: OBJECTIVE_EVALUATED,
		payload: {
			v: 1,
			objective,
			evaluator,
			contractHash,
			verdicts,
			rollup: result,
			outcome: evaluation.outcome,
			remaining: evaluation.remaining,
		},
	});

	return evaluation;
}

/** Every evaluation an objective has had, oldest first. */
export async function evaluationsOf(pool: Pool, objective: string): Promise<Evaluation[]> {
	const events = await read(pool, { objective });
	return events
		.filter((e) => e.type === OBJECTIVE_EVALUATED)
		.map((e) => {
			const p = e.payload;
			return {
				objective: String(p.objective ?? ""),
				evaluator: String(p.evaluator ?? ""),
				verdicts: (p.verdicts ?? []) as Verdict[],
				rollup: p.rollup as Evaluation["rollup"],
				outcome: p.outcome as ObjectiveOutcome,
				remaining: (p.remaining ?? []) as string[],
				contractHash: String(p.contractHash ?? ""),
			};
		});
}
