/**
 * Turning a real error into a failure class.
 *
 * Every error that reaches a run comes from somewhere unhelpful: an RPC node, a swap router, a wallet
 * provider, a database. This is the one place that reads them, so the run loop never has to guess and
 * every kind of failure gets the same answer every time (`respondTo`).
 *
 * Two rules matter more than the patterns:
 *
 * 1. **Unknown means unknown.** Anything not recognised is `unknown`, which pauses the machine and
 *    tells the owner. Guessing "probably transient" is how a system retries a refusal forever.
 * 2. **After a transaction is sent, an unclear failure is `ambiguous`, never transient.** The trade may
 *    have landed. Asking the chain is the only safe answer; retrying could buy twice.
 */

import type { Failure, FailureClass } from "./failure.ts";

/** Where the error came from, which changes what it means. */
export type FailureContext = {
	/** True once a transaction has been sent and could already have landed. */
	sent?: boolean;
};

type Pattern = { class: FailureClass; match: RegExp };

/**
 * Patterns seen from the services Maschina uses. Order matters: the first match wins, so the more
 * specific patterns come first.
 */
const PATTERNS: Pattern[] = [
	// Refused by a wallet provider's policy, or by Maschina's own rules. Never retried.
	{
		class: "authority",
		match: /policy|not authorized|unauthorized|forbidden|recipientnotallowed/i,
	},
	{
		class: "authority",
		match: /policyenginepermissionerror|consensus_needed|activity was rejected/i,
	},
	{ class: "authority", match: /operationnotpermitted|signature verification failed/i },

	// A limit ran out. A person decides what happens next.
	{ class: "budget", match: /spendinglimitexceeded|budget|limit exceeded|insufficient allowance/i },

	// Waiting on something that lifts by itself.
	{ class: "waiting", match: /rate limit|too many requests|429|daily.*cap|quota/i },

	// Will never work as asked, however many times it is tried.
	{
		class: "permanent",
		match: /no route|no routes found|route not found|unknown mint|invalid mint/i,
	},
	{
		class: "permanent",
		match: /slippage|price impact too high|insufficient funds|account not found/i,
	},
	{ class: "permanent", match: /invalid_input|invalid argument|malformed|not a valid/i },

	// Might work if tried again.
	{
		class: "transient",
		match: /timeout|timed out|etimedout|econnreset|econnrefused|socket hang up/i,
	},
	{ class: "transient", match: /fetch failed|network|dns|503|502|504|service unavailable/i },
	{ class: "transient", match: /blockhash not found|node is behind|block height exceeded/i },
	{ class: "transient", match: /connection terminated|too many connections|deadlock detected/i },
];

/** Patterns meaning "we do not know whether it happened", whatever the context. */
const AMBIGUOUS = /was not confirmed|transaction expired|unable to confirm|confirmation timeout/i;

const textOf = (error: unknown): string => {
	if (error instanceof Error) {
		const cause = error.cause === undefined ? "" : ` ${String(error.cause)}`;
		const code = (error as { code?: unknown }).code;
		return `${error.message}${cause}${code === undefined ? "" : ` ${String(code)}`}`;
	}
	if (typeof error === "string") return error;
	if (typeof error === "object" && error !== null) {
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
};

/**
 * Reads how long to wait from a rate limit error, when it says. Returns nothing rather than guessing,
 * because a guessed time is a machine deciding for itself when to try again.
 */
export function resumeTimeFrom(error: unknown, now: Date): Date | undefined {
	const text = textOf(error);
	const seconds = text.match(/retry[- ]after[":\s]+(\d+)/i)?.[1];
	if (seconds) return new Date(now.getTime() + Number(seconds) * 1000);
	const milliseconds = text.match(/retry in (\d+)\s*ms/i)?.[1];
	if (milliseconds) return new Date(now.getTime() + Number(milliseconds));
	return undefined;
}

/** The failure class for an error, with the time it resumes when the error said one. */
export function classifyError(
	error: unknown,
	context: FailureContext = {},
	now: Date = new Date(),
): Failure {
	const text = textOf(error);

	if (AMBIGUOUS.test(text)) return { class: "ambiguous" };

	const matched = PATTERNS.find((pattern) => pattern.match.test(text));

	// After sending, only a definite answer is trusted. Anything vague could already have landed.
	if (
		context.sent &&
		(!matched || matched.class === "transient" || matched.class === "permanent")
	) {
		return { class: "ambiguous" };
	}

	if (!matched) return { class: "unknown" };
	if (matched.class === "waiting") {
		const resumesAt = resumeTimeFrom(error, now);
		return resumesAt ? { class: "waiting", resumesAt } : { class: "waiting" };
	}
	return { class: matched.class };
}

/** The class alone, for callers that only need that. */
export const classFor = (error: unknown, context?: FailureContext): FailureClass =>
	classifyError(error, context).class;
