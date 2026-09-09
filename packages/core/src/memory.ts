/**
 * What a worker is allowed to remember, and how far it counts.
 * `07-CONTEXT-MEMORY` §3, §4 and §5.
 *
 * **This is where the previous implementation went furthest wrong**, and the
 * plan says so before it says anything else. Memory is where a system starts
 * believing things nobody checked. Every remembered thing carries where it came
 * from and how far it applies, or it is not remembered.
 *
 * Three kinds, and reliability decreases as usefulness increases, which is why
 * origin and confidence travel with the content rather than being metadata
 * somebody could drop on the way into a prompt.
 */

/** `07-CONTEXT-MEMORY` §3. */
export type MemoryKind =
	/** What happened. A projection of the log, and therefore always true. */
	| "history"
	/** An asserted fact. "This project uses Postgres." Can be wrong, can go stale. */
	| "knowledge"
	/** A generalisation linked to outcomes. Least reliable, most useful. */
	| "lesson";

/** How a record came to exist. `07-CONTEXT-MEMORY` §4. */
export type MemoryOrigin =
	/** Folded from the log. Not an opinion. */
	| "derived"
	| "asserted_by_worker"
	| "asserted_by_human"
	/** Somebody generalised. The most dangerous origin and the most valuable. */
	| "inferred";

/**
 * How far a record counts. `07-CONTEXT-MEMORY` §5.
 *
 * **Scoping is a security control, not organisation.** Without it, one worker
 * that reads a malicious file in a repository can write a poisoned lesson that
 * every future worker retrieves. Scope bounds the damage to that worker until
 * something independent confirms it.
 */
export type MemoryScope = "objective" | "worker" | "project" | "global";

export type MemoryStatus = "active" | "deprecated";

export interface MemoryRecord {
	readonly id: string;
	readonly kind: MemoryKind;
	readonly content: string;
	readonly origin: MemoryOrigin;
	/** Event ids and artifact hashes supporting it. Empty is a warning sign. */
	readonly evidence: readonly string[];
	/** How strongly it is held, 0 to 1. */
	readonly confidence: number;
	readonly scope: MemoryScope;
	/** Which objective, worker or project it belongs to. Null at global scope. */
	readonly scopeId: string | null;
	/** Who wrote it down. */
	readonly author: string;
	/**
	 * Whether this came from content nobody vouches for: a repository file, a web
	 * page, command output (`07-CONTEXT-MEMORY` §2). It bounds promotion, and it
	 * is the difference between a fact and something a file said.
	 */
	readonly fromUntrusted: boolean;
	readonly status: MemoryStatus;
	/** What contradicted it, when something did. Nothing is ever deleted. */
	readonly contradictedBy: string | null;
	readonly createdAt: Date;
	/** Independent confirmations, by workers that did not share a context. */
	readonly confirmations: readonly string[];
}

const ORDER: MemoryScope[] = ["objective", "worker", "project", "global"];

/** Is `have` at least as wide as `need`? */
export function scopeReaches(have: MemoryScope, need: MemoryScope): boolean {
	return ORDER.indexOf(have) >= ORDER.indexOf(need);
}

export interface PromotionRequest {
	readonly record: MemoryRecord;
	readonly to: MemoryScope;
	/** Who is asking, so a worker cannot confirm itself. */
	readonly by: string;
}

export type PromotionVerdict =
	| { readonly allowed: true }
	| { readonly allowed: false; readonly why: string };

/**
 * May this record be promoted? `07-CONTEXT-MEMORY` §5.
 *
 * The rule that matters: **a record derived from untrusted content cannot go
 * beyond worker scope without independent confirmation from a worker that did
 * not share its context.** One compromised context must not be able to launder
 * itself into project-wide belief.
 *
 * Pure, so the contamination defence is a function anybody can read rather than
 * a paragraph somebody has to remember.
 */
export function mayPromote(request: PromotionRequest): PromotionVerdict {
	const { record, to, by } = request;

	if (!scopeReaches(to, record.scope)) {
		return { allowed: false, why: "promotion widens scope; this would narrow it" };
	}
	if (to === record.scope) {
		return { allowed: false, why: `it is already at ${to} scope` };
	}
	if (record.status !== "active") {
		return { allowed: false, why: `it is ${record.status} and cannot be promoted` };
	}

	// Global is a human decision, always. `07-CONTEXT-MEMORY` §5 gives global
	// exactly one route in, and no amount of agreement between workers is it.
	if (to === "global" && !by.startsWith("human:")) {
		return {
			allowed: false,
			why: "global scope is promoted by a human only, however many workers agree",
		};
	}

	if (by === record.author) {
		return {
			allowed: false,
			why: "the worker that wrote it cannot be the one that confirms it",
		};
	}

	// The contamination defence.
	if (record.fromUntrusted && !scopeReaches("worker", to)) {
		const independent = record.confirmations.filter((c) => c !== record.author);
		if (independent.length === 0) {
			return {
				allowed: false,
				why:
					"this came from untrusted content and has no independent confirmation, so it " +
					"cannot travel past the worker that read it",
			};
		}
	}

	return { allowed: true };
}

/**
 * How a record should be presented in a prompt.
 *
 * `07-CONTEXT-MEMORY` §4: retrieval must never present inference as fact. A
 * lesson inferred from three observations and something the operator stated are
 * different things, and flattening them into the same prose is how a worker
 * becomes confidently wrong.
 *
 * So the origin is part of the sentence, not a field beside it that a prompt
 * builder can forget.
 */
export function asContext(record: MemoryRecord): string {
	const preface = {
		derived: "From the record",
		asserted_by_human: "Stated by a person",
		asserted_by_worker: "Asserted by a worker",
		inferred: "Inferred, and may be wrong",
	}[record.origin];

	const caveat = record.fromUntrusted ? ", from content nobody vouches for" : "";
	const strength = record.confidence < 0.5 ? ", held weakly" : "";
	return `${preface}${caveat}${strength}: ${record.content}`;
}
