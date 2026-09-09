/**
 * The effect path. `03-RUNTIME` §2 steps 4 to 7, and `01-PRINCIPLES` P5.
 *
 *   4. AUTHORIZE   check the Intent against held capabilities
 *   5. RECORD      write the Intent event      <- write-ahead point
 *   6. EXECUTE     perform the effect
 *   7. RECORD      write the Outcome event
 *
 * **Nothing reaches the world that was not written down first.** If the effect
 * happened before the record, a crash produces an undocumented change to the
 * world, which is the worst possible state to recover from. And an intent that
 * fails authorization never becomes an event, so it never becomes an attempt:
 * authorization is enforced by control flow rather than by convention.
 *
 * Steps 5 to 7 are the only window in which anything changes. A crash inside it
 * leaves an Intent with no Outcome, which is the one crash window in the system
 * and is resolved by effect class (`03-RUNTIME` §3).
 */

import type { AuthorizationRequest, EffectClass } from "@maschina/core";
import type { ControlPlane } from "./control-plane.ts";

/**
 * Payload schema version. ADR-006.
 *
 * Duplicated from `@maschina/db` rather than imported, because importing it
 * would give the worker a database dependency for the sake of one integer, and
 * the node boundary is not worth trading for that. The CI boundary check would
 * reject it anyway.
 *
 * If these ever drift, the control plane is the one that decides: it writes the
 * events.
 */
const PAYLOAD_V = 1;

export const WORKER_DECIDED = "worker.decided";
export const EFFECT_INTENDED = "effect.intended";
export const EFFECT_OUTCOME = "effect.outcome";

/**
 * `03-RUNTIME` §3. `unknown` is not a failure and must never be rounded to one:
 * a worker that assumes an unknown effect failed will duplicate it, and one that
 * assumes it succeeded builds on a false premise. Both are worse than stopping.
 */
export type OutcomeResult = "succeeded" | "failed" | "unknown";

/** What a worker decided to do, before it is known whether it may. */
export interface Decision {
	readonly worker: string;
	readonly objective: string | null;
	/** Why, in prose. Recorded for audit, never load-bearing for correctness. */
	readonly reasoning: string;
}

/** An effect the worker is asking to perform. */
export interface ProposedEffect {
	readonly capabilityId: string;
	readonly operation: AuthorizationRequest["operation"];
	readonly target: string;
	/** Executor-specific detail. For a filesystem write, the bytes. */
	readonly payload: Readonly<Record<string, unknown>>;
}

/** Performs the effect in the world. Called only after the Intent is durable. */
export type Executor = (effect: ProposedEffect) => Promise<Record<string, unknown>>;

export type EffectReport =
	| { readonly performed: false; readonly reason: string; readonly detail: string }
	| {
			readonly performed: true;
			readonly result: OutcomeResult;
			readonly intentId: bigint;
			readonly detail: Record<string, unknown>;
	  };

/**
 * Run one effect through the full sequence.
 *
 * Returns rather than throws on a denial, because a denial is an ordinary
 * recorded outcome rather than an exception. It is already in the log by the
 * time this returns: `authorize` writes it.
 */
export async function performEffect(
	controlPlane: ControlPlane,
	decision: Decision,
	effect: ProposedEffect,
	effectClass: EffectClass,
	execute: Executor,
): Promise<EffectReport> {
	// The worker chose to attempt something. Recorded before we know whether it
	// is allowed, because what a worker tried to do is a fact worth keeping even
	// when the answer is no.
	const decided = await controlPlane.append({
		actor: decision.worker,
		type: WORKER_DECIDED,
		objective: decision.objective,
		payload: {
			v: PAYLOAD_V,
			reasoning: decision.reasoning,
			operation: effect.operation,
			target: effect.target,
			capabilityId: effect.capabilityId,
		},
	});

	// Step 4. A denial is recorded inside authorize and stops everything here.
	const authorization = await controlPlane.authorize({
		capabilityId: effect.capabilityId,
		holder: decision.worker,
		operation: effect.operation,
		target: effect.target,
	});

	if (!authorization.granted) {
		return { performed: false, reason: authorization.reason, detail: authorization.detail };
	}

	// Step 5. The write-ahead point. After this line the world may change, and
	// the log already says what was about to happen.
	const intent = await controlPlane.append({
		actor: decision.worker,
		type: EFFECT_INTENDED,
		objective: decision.objective,
		causation: decided.id,
		payload: {
			v: PAYLOAD_V,
			capabilityId: effect.capabilityId,
			operation: effect.operation,
			target: effect.target,
			effectClass,
			payload: effect.payload,
		},
	});

	// Steps 6 and 7.
	let result: OutcomeResult;
	let detail: Record<string, unknown>;
	try {
		detail = await execute(effect);
		result = "succeeded";
	} catch (error: unknown) {
		// A thrown executor means the effect did not happen, for this effect class.
		// An effect that might have happened must report `unknown` itself rather
		// than throw, because this catch cannot tell the difference and guessing
		// is what P8 forbids.
		result = "failed";
		detail = { error: error instanceof Error ? error.message : String(error) };
	}

	await controlPlane.append({
		actor: decision.worker,
		type: EFFECT_OUTCOME,
		objective: decision.objective,
		causation: intent.id,
		payload: {
			v: PAYLOAD_V,
			capabilityId: effect.capabilityId,
			result,
			operation: effect.operation,
			target: effect.target,
			detail,
		},
	});

	return { performed: true, result, intentId: intent.id, detail };
}
