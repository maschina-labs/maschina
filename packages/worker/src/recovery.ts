/**
 * Recovery. `03-RUNTIME` §3 and §4.
 *
 * A node dies mid-objective. Another one picks the worker up. This is what it
 * knows when it starts, and it comes from one place: the log.
 *
 * **Nothing is stored on the node.** No checkpoint file, no resume token, no
 * in-memory plan flushed on shutdown. A node that crashed did not get to write
 * anything on the way down, so anything relying on it having done so is a
 * recovery path that works in tests and fails in reality. Everything here is
 * folded from events that were already durable before the crash, which is the
 * whole reason the write-ahead point exists.
 *
 * **The worker decides fresh.** This does not reconstruct a plan or replay a
 * decision. It reports what happened, and the worker looks at that and chooses
 * what to do now. A resumed worker is not a paused worker being unpaused; it is
 * a worker being told the truth about a situation it did not witness.
 */

import type { Event } from "@maschina/core";
import { EFFECT_INTENDED, EFFECT_OUTCOME } from "./effect.ts";

/**
 * An effect whose Intent is in the log with no Outcome after it.
 *
 * This is the crash window, and the only ambiguous state in the system. The
 * effect may have happened, may not have, and the log cannot say which, because
 * the process died in the gap between deciding to act and recording what
 * happened.
 */
export interface Unfinished {
	readonly intentId: bigint;
	readonly capabilityId: string;
	readonly operation: string;
	readonly target: string;
	/** How a crash here is to be resolved. `03-RUNTIME` §3. */
	readonly effectClass: string;
	readonly payload: Record<string, unknown>;
	/** The epoch that wrote the Intent, so it is clear which lease was acting. */
	readonly epoch: bigint;
}

export interface Recovered {
	/** Every effect that completed, in order, whatever the result. */
	readonly finished: readonly { target: string; operation: string; result: string }[];
	/**
	 * Effects caught in the crash window. Usually zero or one: a step is one
	 * world effect, so a single process can only be halfway through one at a
	 * time. More than one means more than one process was writing, which is what
	 * fencing exists to make impossible, and worth noticing loudly.
	 */
	readonly unfinished: readonly Unfinished[];
	/** The highest epoch seen, which is the generation the log currently belongs to. */
	readonly epoch: bigint;
}

/**
 * What a worker knows on restart, folded from its own history.
 *
 * Pure, so recovery is testable without killing a process, and so the same
 * function can be run against the log by a human asking what state something is
 * in.
 */
export function recover(events: readonly Event[]): Recovered {
	const intents = new Map<bigint, Event>();
	const finished: { target: string; operation: string; result: string }[] = [];
	let epoch = 0n;

	for (const event of events) {
		if (event.epoch > epoch) epoch = event.epoch;

		if (event.type === EFFECT_INTENDED) {
			intents.set(event.id, event);
		} else if (event.type === EFFECT_OUTCOME) {
			// An Outcome names the Intent it answers through causation, rather than
			// the two being matched by position. Position would pair the wrong ones
			// the moment anything interleaved.
			if (event.causation !== null) intents.delete(event.causation);
			finished.push({
				target: String(event.payload.target ?? ""),
				operation: String(event.payload.operation ?? ""),
				result: String(event.payload.result ?? "unknown"),
			});
		}
	}

	const unfinished = [...intents.values()].map((intent) => ({
		intentId: intent.id,
		capabilityId: String(intent.payload.capabilityId ?? ""),
		operation: String(intent.payload.operation ?? ""),
		target: String(intent.payload.target ?? ""),
		effectClass: String(intent.payload.effectClass ?? "unsafe"),
		payload: (intent.payload.payload ?? {}) as Record<string, unknown>,
		epoch: intent.epoch,
	}));

	return { finished, unfinished, epoch };
}

/**
 * What to do about an effect caught in the crash window. `03-RUNTIME` §3.
 *
 * The effect class decides, and it was frozen into the Intent before the effect
 * ran, precisely so this question has an answer written down rather than one
 * argued about afterwards.
 */
export type Resolution = "retry" | "reconcile" | "escalate";

export function resolutionFor(effectClass: string): Resolution {
	switch (effectClass) {
		// Doing it twice is the same as doing it once, so the cheapest correct
		// move is to do it again and stop wondering.
		case "idempotent":
			return "retry";
		// The world can be asked what actually happened. Ask it, then decide.
		case "reconcile":
		case "reconcilable":
			return "reconcile";
		// Either it happened or it did not, doing it twice is not safe, and
		// nothing can be asked. P8 says ambiguity blocks: a human decides.
		default:
			return "escalate";
	}
}
