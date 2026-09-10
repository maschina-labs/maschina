/**
 * Recording what each step got done, and stopping when nothing does.
 * `03-RUNTIME` §8, `09-EVALUATION` §5.
 *
 * Two things, and they are the same thing seen from either end.
 *
 * **Progress.** Each step says what it produced. A run of steps producing
 * nothing suspends the worker with a question, rather than letting a budget
 * bound it eventually and expensively.
 *
 * **Continuous evaluation.** A criterion satisfied at step two is recorded at
 * step two, not rediscovered at the end. That makes progress visible while the
 * work is happening, and it means a stall report can say which criteria are
 * already met rather than only that something is stuck.
 */

import type { StepOutcome } from "@maschina/core";
import { foldProgress, stalled } from "@maschina/core";
import type { Pool } from "pg";
import { append, epochFor, PAYLOAD_V, read } from "./log.ts";
import { suspendAsking } from "./suspension.ts";

export const STEP_COMPLETED = "step.completed";
export const CRITERION_SATISFIED = "criterion.satisfied";

/**
 * Record what a step produced.
 *
 * Required rather than optional. A step that will not say what it produced is
 * indistinguishable from one that produced nothing, and the honest reading of
 * that is that it produced nothing.
 */
export async function recordStep(
	pool: Pool,
	worker: string,
	objective: string,
	step: StepOutcome,
): Promise<void> {
	const epoch = await epochFor(pool, worker);

	await append(pool, {
		actor: worker,
		objective,
		epoch,
		type: STEP_COMPLETED,
		payload: {
			v: PAYLOAD_V,
			artifacts: [...step.artifacts],
			observations: [...step.observations],
			changedTheWorld: step.changedTheWorld,
			satisfied: [...step.satisfied],
		},
	});

	// Recorded when it happens, one event each, so "when was this criterion
	// met" is answerable rather than inferred from a final verdict.
	for (const criterionId of step.satisfied) {
		await append(pool, {
			actor: worker,
			objective,
			epoch,
			type: CRITERION_SATISFIED,
			payload: { v: PAYLOAD_V, criterionId, objective },
		});
	}
}

/** What has happened so far on an objective. */
export async function progressOf(pool: Pool, objective: string) {
	const steps = (await read(pool, { objective }))
		.filter((e) => e.type === STEP_COMPLETED)
		.map((e): StepOutcome => {
			const p = e.payload;
			return {
				artifacts: Array.isArray(p.artifacts) ? (p.artifacts as string[]) : [],
				observations: Array.isArray(p.observations) ? (p.observations as string[]) : [],
				changedTheWorld: p.changedTheWorld === true,
				satisfied: Array.isArray(p.satisfied) ? (p.satisfied as string[]) : [],
			};
		});
	return foldProgress(steps);
}

/**
 * Stop if nothing is happening, and ask something answerable.
 *
 * Returns whether it suspended, so a worker loop can stop rather than having to
 * ask again. The question names what is done, what remains, and what was last
 * tried, because `STAGE_1_PLAN` criterion 3 wants a question a person can answer
 * in one reply rather than a report that something is stuck.
 */
export async function suspendIfStalled(
	pool: Pool,
	worker: string,
	objective: string,
	criteria: readonly string[],
	lastAttempt: string,
	limit?: number,
): Promise<boolean> {
	const progress = await progressOf(pool, objective);
	const stall = stalled(progress, criteria, lastAttempt, limit);
	if (!stall.stuck) return false;

	await suspendAsking(pool, worker, objective, stall.reason, stall.question);
	return true;
}

/** When each criterion was met, from the log rather than from a final verdict. */
export async function satisfiedWhen(
	pool: Pool,
	objective: string,
): Promise<{ criterionId: string; at: Date; step: bigint }[]> {
	return (await read(pool, { objective }))
		.filter((e) => e.type === CRITERION_SATISFIED)
		.map((e) => ({
			criterionId: String(e.payload.criterionId ?? ""),
			at: e.recordedAt,
			step: e.id,
		}));
}
