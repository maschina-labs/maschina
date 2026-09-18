/**
 * One run, start to finish.
 *
 * Every run walks the same eight phases in the same order, whatever the machine does. The order is the
 * safety: the world is only touched in `execute`, and `execute` only happens after the intent is in the
 * record. So a crash anywhere leaves one of two situations, both recoverable:
 *
 *   - Crashed before the intent was recorded: nothing happened, and nothing was written. Run it again.
 *   - Crashed after: the record says what was meant to happen, and the world can be asked whether it
 *     did (`reconcilable` effects) rather than guessed at.
 *
 * Nothing here knows what kind of machine it is running, or how to talk to Solana. Both arrive as
 * ports, so this loop is tested by making each of them fail at each step.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import { type FailureClass, respondTo } from "./failure.ts";
import {
	decideFor,
	type MachineKind,
	type MachineView,
	type ProposedAction,
} from "./machine-kind.ts";
import { assertTransition, type RunEnd, type RunPhase } from "./run.ts";

export type RunRequest = {
	runId: string;
	machineId: string;
	/** The moment the run is for, which is not when the code happens to run. */
	dueAt: Date;
	attempt: number;
};

export type AuthorizationResult =
	| { allowed: true }
	| { allowed: false; rule: string; reason: string };

export type ExecutionResult = {
	signature: string;
	inputAmount: bigint;
	outputAmount: bigint;
	feeLamports: bigint;
};

/** Everything the loop needs from the outside world. Each one is a place a run can fail. */
export type RunPorts = {
	/** What the machine is: its kind, its settings, and whether it may act at all. */
	restore(request: RunRequest): Promise<{
		kind: MachineKind<unknown>;
		settings: unknown;
		canAct: boolean;
		stoppedBecause?: string;
	}>;
	/** What the machine can see: balances, budget, totals. */
	assemble(request: RunRequest): Promise<MachineView>;
	/** Maschina's own rules, checked before anything is signed. */
	authorize(request: RunRequest, action: ProposedAction): Promise<AuthorizationResult>;
	/** Writes the intent to the record. Returns the trade id everything after refers to. */
	recordIntent(request: RunRequest, action: ProposedAction): Promise<{ tradeId: string }>;
	/** The only step that changes the world. */
	execute(request: RunRequest, action: ProposedAction, tradeId: string): Promise<ExecutionResult>;
	recordOutcome(
		request: RunRequest,
		outcome:
			| { kind: "completed"; tradeId: string; result: ExecutionResult }
			| { kind: "failed"; tradeId: string; failure: FailureClass; reason: string }
			| { kind: "refused"; tradeId?: string; rule: string; reason: string }
			| { kind: "skipped"; reason: string; detail?: string },
	): Promise<void>;
	/** What to do with the machine afterwards: keep going, pause, stop. */
	assess(request: RunRequest, ending: RunEnding): Promise<void>;
	/** Turns an unknown error into a failure class. Lives outside so it can learn new errors. */
	classify(error: unknown): FailureClass;
};

export type RunEnding =
	| { end: "finished"; tradeId: string; result: ExecutionResult }
	| { end: "skipped"; reason: string; detail?: string }
	| { end: "refused"; rule: string; reason: string }
	| { end: "failed"; phase: RunPhase; failure: FailureClass; reason: string; tradeId?: string };

export type RunReport = {
	ending: RunEnding;
	/** Every phase the run actually entered, in order, for tracing. */
	phases: RunPhase[];
	/** What should happen next, from the failure rules. Absent when the run ended cleanly. */
	next?: ReturnType<typeof respondTo>;
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Runs one occurrence to its end. It never throws: every ending, including a crash, comes back as a
 * report, because a run that vanishes leaves the record unfinished.
 */
export async function runOnce(
	ports: RunPorts,
	request: RunRequest,
): Promise<Result<RunReport, MaschinaError>> {
	const phases: RunPhase[] = [];
	let phase: RunPhase = "restore";
	const enter = (next: RunPhase) => {
		assertTransition(phase, next);
		phase = next;
		phases.push(next);
	};
	phases.push(phase);

	/** Ends the run, recording the outcome and assessing the machine, and never throwing. */
	const finish = async (ending: RunEnding): Promise<Result<RunReport, MaschinaError>> => {
		try {
			await ports.assess(request, ending);
		} catch (error) {
			// Assessment is bookkeeping. A failure here must not hide what already happened.
			return ok({
				ending,
				phases,
				next: respondTo({ class: ports.classify(error) }, request.attempt),
			});
		}
		return ok({
			ending,
			phases,
			...(ending.end === "failed"
				? { next: respondTo({ class: ending.failure }, request.attempt) }
				: {}),
		});
	};

	const failed = async (
		at: RunPhase,
		error: unknown,
		tradeId?: string,
	): Promise<Result<RunReport, MaschinaError>> => {
		const failure = ports.classify(error);
		const reason = message(error);
		try {
			if (tradeId) {
				await ports.recordOutcome(request, { kind: "failed", tradeId, failure, reason });
			}
		} catch {
			// The record is unreachable. The report still says what happened, and the run is retried.
		}
		return finish({ end: "failed", phase: at, failure, reason, ...(tradeId ? { tradeId } : {}) });
	};

	// 1. Restore: what is this machine, and may it act at all?
	let restored: Awaited<ReturnType<RunPorts["restore"]>>;
	try {
		restored = await ports.restore(request);
	} catch (error) {
		return failed("restore", error);
	}
	if (!restored.canAct) {
		const detail = restored.stoppedBecause;
		enter("assemble");
		enter("decide");
		const ending: RunEnding = {
			end: "skipped",
			reason: "machine_not_running",
			...(detail ? { detail } : {}),
		};
		try {
			await ports.recordOutcome(request, {
				kind: "skipped",
				reason: "machine_not_running",
				...(detail ? { detail } : {}),
			});
		} catch (error) {
			return failed("decide", error);
		}
		return finish(ending);
	}

	// 2. Assemble: everything the machine is allowed to see.
	enter("assemble");
	let view: MachineView;
	try {
		view = await ports.assemble(request);
	} catch (error) {
		return failed("assemble", error);
	}

	// 3. Decide: the machine's own judgement, with no access to the world.
	enter("decide");
	const decision = decideFor(restored.kind, restored.settings, view);
	if (decision.decide !== "act") {
		const detail = decision.decide === "wait" ? decision.detail : undefined;
		const reason = decision.decide === "wait" ? decision.because : decision.because;
		try {
			await ports.recordOutcome(request, {
				kind: "skipped",
				reason,
				...(detail ? { detail } : {}),
			});
		} catch (error) {
			return failed("decide", error);
		}
		return finish({ end: "skipped", reason, ...(detail ? { detail } : {}) });
	}

	// 4. Authorize: Maschina's rules, before anything is signed or sent.
	enter("authorize");
	let authorized: AuthorizationResult;
	try {
		authorized = await ports.authorize(request, decision.action);
	} catch (error) {
		return failed("authorize", error);
	}
	if (!authorized.allowed) {
		try {
			await ports.recordOutcome(request, {
				kind: "refused",
				rule: authorized.rule,
				reason: authorized.reason,
			});
		} catch (error) {
			return failed("authorize", error);
		}
		return finish({ end: "refused", rule: authorized.rule, reason: authorized.reason });
	}

	// 5. Record the intent. Nothing has touched the world yet, and nothing will until this is written.
	enter("record_intent");
	let tradeId: string;
	try {
		({ tradeId } = await ports.recordIntent(request, decision.action));
	} catch (error) {
		return failed("record_intent", error);
	}

	// 6. Execute: the only step that changes anything outside Maschina.
	enter("execute");
	let result: ExecutionResult;
	try {
		result = await ports.execute(request, decision.action, tradeId);
	} catch (error) {
		return failed("execute", error, tradeId);
	}

	// 7. Record the outcome. The world has changed; the record must catch up.
	enter("record_outcome");
	try {
		await ports.recordOutcome(request, { kind: "completed", tradeId, result });
	} catch (error) {
		// The trade happened but could not be written down. That is ambiguous until reconciled, never
		// a plain failure, because retrying blindly could buy twice.
		return finish({
			end: "failed",
			phase: "record_outcome",
			failure: "ambiguous",
			reason: message(error),
			tradeId,
		});
	}

	// 8. Assess: what this run means for the machine.
	enter("assess");
	return finish({ end: "finished", tradeId, result });
}

/** Refuses a run request that could never be valid, before any port is called. */
export function checkRequest(request: RunRequest): Result<RunRequest, MaschinaError> {
	if (!Number.isInteger(request.attempt) || request.attempt < 1) {
		return err(new MaschinaError("invalid_input", "an attempt counts from one"));
	}
	return ok(request);
}

export type { RunEnd, RunPhase };
