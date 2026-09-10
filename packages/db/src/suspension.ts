/**
 * Suspension, and what makes one resumable. `03-RUNTIME` §5 and §6.
 *
 * A worker stops for one of two reasons, and telling them apart is the whole
 * point of this file.
 *
 * **Waiting for time.** A provider quota lifts at a known hour. A lease expired
 * while the machine slept. Nothing is needed from anybody: the world will be
 * different later and the work can carry on. This suspends with a resume time
 * and something wakes it.
 *
 * **Waiting for a person.** The budget is spent, authority was refused, the
 * objective is ambiguous. No amount of waiting changes any of those. This
 * suspends with a question and stays suspended until somebody answers.
 *
 * `03-RUNTIME` §5 has a row for each of the failures underneath, and neither
 * response fits a quota. Transient says retry with backoff, which hammers a wall
 * for hours. Budget says suspend and escalate, which wakes a human to watch a
 * clock. `15-OPEN-QUESTIONS` Q10 is whether this deserves to be its own class,
 * and this is the implementation that answers it.
 *
 * **A resume time is never a guess.** If a provider will not say when a limit
 * lifts, the worker asks a person instead. `01-PRINCIPLES` P8: ambiguity blocks,
 * and picking a number because one was needed is exactly the guess it forbids.
 */

import type { Pool } from "pg";
import { append, epochFor, read } from "./log.ts";

export const WORKER_SUSPENDED = "worker.suspended";
export const WORKER_RESUMED = "worker.resumed";

/** Why a worker stopped, and therefore what would start it again. */
export type SuspensionKind =
	/** The world will be different at a known time. Nobody needs to do anything. */
	| "until"
	/** Somebody has to answer something. A clock will not help. */
	| "question";

export interface Suspension {
	readonly worker: string;
	readonly objective: string | null;
	readonly kind: SuspensionKind;
	readonly reason: string;
	/** When it can carry on. Null for a question, which no time resolves. */
	readonly resumeAt: Date | null;
	/** What a person has to answer. Null when nobody is being asked. */
	readonly question: string | null;
	readonly since: Date;
}

/**
 * Stop until a stated time.
 *
 * The caller has to know the time. Nothing here invents one, because a made up
 * retry time is a guess wearing a schedule.
 */
export async function suspendUntil(
	pool: Pool,
	worker: string,
	objective: string | null,
	reason: string,
	resumeAt: Date,
	epoch?: bigint,
): Promise<void> {
	if (Number.isNaN(resumeAt.getTime())) {
		throw new Error(
			`cannot suspend ${worker} until an unreadable time. If the provider did not say ` +
				"when the limit lifts, suspend with a question instead of choosing a number.",
		);
	}
	await append(pool, {
		actor: worker,
		objective,
		type: WORKER_SUSPENDED,
		epoch: epoch ?? (await epochFor(pool, worker)),
		payload: {
			v: 1,
			worker,
			kind: "until" satisfies SuspensionKind,
			reason,
			resumeAt: resumeAt.toISOString(),
		},
	});
}

/**
 * Stop and ask.
 *
 * The question is required and has to be answerable. `STAGE_1_PLAN` proof
 * criterion 3 is that a stuck worker escalates with a specific answerable
 * question, not that it reports being stuck.
 */
export async function suspendAsking(
	pool: Pool,
	worker: string,
	objective: string | null,
	reason: string,
	question: string,
	epoch?: bigint,
): Promise<void> {
	if (question.trim().length === 0) {
		throw new Error(
			`${worker} cannot suspend without a question. "It is stuck" is a status, not something ` +
				"a person can answer.",
		);
	}
	await append(pool, {
		actor: worker,
		objective,
		type: WORKER_SUSPENDED,
		epoch: epoch ?? (await epochFor(pool, worker)),
		payload: {
			v: 1,
			worker,
			kind: "question" satisfies SuspensionKind,
			reason,
			question,
		},
	});
}

/**
 * Carry on, and say what made it possible.
 *
 * `answeredBy` is who said so. A worker suspended on a question resumes because
 * a person answered it, and `07-CONTEXT-MEMORY` §2 makes that the difference
 * between instruction and content: the same words in a forge comment are an
 * observation, and here they are an instruction, because of who they came from
 * and how they arrived.
 *
 * **It is a claim, not an authenticated identity.** There are no accounts yet.
 * Recording the claim now means the shape is right when there are, rather than
 * discovering later that every historical resumption is anonymous.
 */
export async function resume(
	pool: Pool,
	worker: string,
	objective: string | null,
	because: string,
	epoch?: bigint,
	answeredBy?: string,
): Promise<void> {
	await append(pool, {
		actor: worker,
		objective,
		type: WORKER_RESUMED,
		epoch: epoch ?? (await epochFor(pool, worker)),
		payload: {
			v: 1,
			worker,
			because,
			...(answeredBy !== undefined ? { answeredBy } : {}),
		},
	});
}

/** Whether a worker is stopped right now, and what would start it. */
export function foldSuspension(
	events: readonly { type: string; payload: Record<string, unknown>; recordedAt: Date }[],
): Suspension | null {
	let current: Suspension | null = null;

	for (const event of events) {
		if (event.type === WORKER_SUSPENDED) {
			const p = event.payload;
			const kind = p.kind === "until" ? "until" : "question";
			current = {
				worker: String(p.worker ?? ""),
				objective: null,
				kind,
				reason: String(p.reason ?? ""),
				resumeAt: typeof p.resumeAt === "string" ? new Date(p.resumeAt) : null,
				question: typeof p.question === "string" ? p.question : null,
				since: event.recordedAt,
			};
		} else if (event.type === WORKER_RESUMED) {
			current = null;
		}
	}
	return current;
}

/**
 * Is it time?
 *
 * A suspension waiting on a question is never due, however long it has been.
 * That is the distinction the whole file exists for: waiting longer does not
 * answer anything.
 */
export function isDue(suspension: Suspension, now: Date = new Date()): boolean {
	if (suspension.kind !== "until") return false;
	if (suspension.resumeAt === null) return false;
	return suspension.resumeAt <= now;
}

/** What a worker is waiting for, folded from its own history. */
export async function getSuspension(pool: Pool, worker: string): Promise<Suspension | null> {
	const events = await read(pool, { actor: worker });
	const suspension = foldSuspension(events);
	if (suspension === null) return null;

	// The objective it stopped on, taken from the event rather than the fold, so
	// the fold stays a pure function of the payloads.
	const last = events.filter((e) => e.type === WORKER_SUSPENDED).at(-1);
	return { ...suspension, objective: last?.objective ?? null };
}
