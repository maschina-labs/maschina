/**
 * Picking up a run that stopped between recording its intent and recording its outcome.
 *
 * At that moment the record says what was meant to happen and nothing says whether it did. What to do
 * depends on the action itself, never on how hopeful we feel:
 *
 *   idempotent    doing it twice is the same as doing it once, so do it again
 *   reconcilable  it might have happened, and the world can be asked, so ask before anything else
 *   unsafe        neither, so stop and ask a person
 *
 * Solana transactions are reconcilable: a signature is a question the chain can answer. That is what
 * makes "did my machine buy twice?" a question with an answer rather than a worry.
 *
 * Judging repeated failure belongs here too, and is read from the record rather than from what a
 * machine says about itself: a machine that keeps failing the same way is paused and the owner told.
 */

import type { EffectClass, Recovery } from "./effect.ts";
import { recoveryFor } from "./effect.ts";
import type { FailureClass } from "./failure.ts";

export type UnfinishedRun = {
	runId: string;
	machineId: string;
	tradeId: string;
	effect: EffectClass;
	/** The transaction's signature, when one was produced before the crash. */
	signature?: string;
	attempt: number;
};

export type RecoveryPlan =
	| { do: "repeat"; because: string }
	| { do: "ask_the_world"; signature?: string; because: string }
	| { do: "ask_a_person"; because: string };

/**
 * What to do with a run that never recorded its outcome.
 *
 * A reconcilable action with no signature is still reconcilable: the machine's wallet and its recent
 * transactions can be read, which is safer than assuming nothing happened.
 */
export function planRecovery(run: UnfinishedRun): RecoveryPlan {
	const recovery: Recovery = recoveryFor(run.effect);
	switch (recovery) {
		case "repeat":
			return { do: "repeat", because: "doing this again has the same effect as doing it once" };
		case "ask_the_world":
			return {
				do: "ask_the_world",
				...(run.signature ? { signature: run.signature } : {}),
				because: run.signature
					? "the transaction may have landed, and its signature can be looked up"
					: "the transaction may have been sent, so the wallet's recent history is checked first",
			};
		case "ask_a_person":
			return {
				do: "ask_a_person",
				because: "this action cannot be repeated or checked, so a person decides",
			};
	}
}

/** What the world said when it was asked. */
export type WorldAnswer =
	| { happened: true; signature: string }
	| { happened: false }
	| { unclear: true };

export type ReconciliationResult =
	| { settle: "completed"; signature: string }
	| { settle: "not_done"; retry: boolean }
	| { settle: "still_unknown" };

/** Turns the world's answer into what the record should say. */
export function reconcile(answer: WorldAnswer): ReconciliationResult {
	if ("happened" in answer && answer.happened) {
		return { settle: "completed", signature: answer.signature };
	}
	if ("happened" in answer) return { settle: "not_done", retry: true };
	// Still unclear. Nothing is written and nothing is retried: guessing here is how money is lost twice.
	return { settle: "still_unknown" };
}

export const REPEATED_FAILURE_LIMIT = 3;

export type RunFailureHistory = {
	/** The most recent failures for one machine, newest first. */
	recent: { failure: FailureClass; reason: string }[];
};

export type HealthJudgement =
	| { pause: false }
	| { pause: true; reason: string; failure: FailureClass; times: number };

/**
 * Whether a machine should be paused for failing the same way over and over.
 *
 * Read from the record, so a machine cannot talk its way out of it. Three failures of the same class in
 * a row is the line: twice can be bad luck, three times is something that needs a person.
 */
export function judgeHealth(history: RunFailureHistory): HealthJudgement {
	const [latest] = history.recent;
	if (!latest) return { pause: false };

	let sameInARow = 0;
	for (const entry of history.recent) {
		if (entry.failure !== latest.failure) break;
		sameInARow += 1;
	}
	if (sameInARow < REPEATED_FAILURE_LIMIT) return { pause: false };

	return {
		pause: true,
		failure: latest.failure,
		times: sameInARow,
		reason: `${sameInARow} runs in a row failed the same way: ${latest.reason}`,
	};
}
