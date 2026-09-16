/**
 * Every failure falls into exactly one class, and each class has exactly one response. Getting the
 * class wrong is how systems retry a refusal forever, or wake a person to wait for a clock.
 */

export type FailureClass =
	/** Expected to succeed if tried again: a timeout, a rate limit, a dropped connection. */
	| "transient"
	/** Will never succeed as asked: bad input, a missing token, a closed pool. */
	| "permanent"
	/** Unknown whether the effect happened. Resolved by asking the world, never by guessing. */
	| "ambiguous"
	/** Refused by the rules or the wallet policy. */
	| "authority"
	/** A budget or limit ran out. Needs a person's decision. */
	| "budget"
	/** A limit that lifts at a known time. Needs nothing but time. */
	| "waiting";

export type FailureResponse =
	| { action: "retry" }
	| { action: "skip" }
	| { action: "reconcile" }
	| { action: "pause"; notify: boolean }
	| { action: "resume_at"; at: Date };

export type Failure = { class: FailureClass; resumesAt?: Date };

export const MAX_TRANSIENT_ATTEMPTS = 3;

/**
 * Decides what happens after a failure. `attempt` counts from 1.
 * A waiting failure with no known time pauses and asks, because guessing a time is guessing.
 */
export function respondTo(failure: Failure, attempt: number): FailureResponse {
	switch (failure.class) {
		case "transient":
			return attempt < MAX_TRANSIENT_ATTEMPTS
				? { action: "retry" }
				: { action: "pause", notify: true };
		case "permanent":
			return { action: "skip" };
		case "ambiguous":
			return { action: "reconcile" };
		case "authority":
		case "budget":
			return { action: "pause", notify: true };
		case "waiting":
			return failure.resumesAt
				? { action: "resume_at", at: failure.resumesAt }
				: { action: "pause", notify: true };
	}
}

/** Refusals and budget exhaustion are never retried. Retrying a refusal turns a limit into a loop. */
export function isRetryable(failure: Failure): boolean {
	return failure.class === "transient";
}
