/**
 * Scoring what to remember. `07-CONTEXT-MEMORY` §6.
 *
 * Three signals, and optimising any one alone fails distinctly:
 *
 *   **Relevance** to the decision at hand. Alone, it retrieves things that are
 *   topically similar and useless.
 *
 *   **Recency**, because the world changes and stale knowledge about a codebase
 *   is worse than none.
 *
 *   **Reliability**, from origin and confidence. A confirmed fact should outrank
 *   a marginally more similar low-confidence guess.
 *
 * **Every component is kept, not just the total.** The document gives the reason
 * and it is the whole point of this file: when a worker decides badly, we need to
 * know whether it retrieved the wrong things or reasoned badly about the right
 * ones, and those have completely different fixes. A single blended number cannot
 * tell them apart.
 *
 * Pure, so the ranking is a function anybody can read and argue with.
 */

import type { MemoryOrigin, MemoryRecord } from "./memory.ts";

export interface Weights {
	readonly relevance: number;
	readonly recency: number;
	readonly reliability: number;
}

/**
 * Even thirds until something measured says otherwise.
 *
 * Not tuned, and deliberately not tuned: tuning weights against no data is
 * choosing a number and calling it a decision. `15-OPEN-QUESTIONS` is where this
 * belongs once retrieval has produced enough scores to argue about.
 */
export const EVEN: Weights = { relevance: 1 / 3, recency: 1 / 3, reliability: 1 / 3 };

/**
 * How much a record's origin is worth trusting. `07-CONTEXT-MEMORY` §4.
 *
 * Reliability decreases and usefulness increases down the list, which is why
 * this is a separate signal rather than folded into confidence: a confident
 * inference and a stated fact are not the same kind of thing however sure the
 * worker was.
 */
const TRUST: Record<MemoryOrigin, number> = {
	derived: 1,
	asserted_by_human: 0.9,
	asserted_by_worker: 0.6,
	inferred: 0.4,
};

/** What a relevance mechanism has to do, and what it has to be called. */
export interface Relevance {
	/** Recorded with every score, so a ranking can be re-read knowing how it was made. */
	readonly name: string;
	/** Zero to one. */
	score(query: string, record: MemoryRecord): number;
}

/**
 * Relevance by shared words.
 *
 * Not embeddings, and the reason is that nothing produces embeddings yet: the
 * `embedding` model class has no provider (`ADR-009`). `13-ARCHITECTURE` §6 says
 * `pgvector` first when there is one, and a dedicated vector store never as the
 * starting point.
 *
 * This exists so the scored blend, the recording, and the auditing are real now,
 * with the relevance mechanism swappable underneath. Its name travels with every
 * score, so a ranking made this way is never mistaken for one made another way.
 */
export const bySharedWords: Relevance = {
	name: "shared-words",
	score(query, record) {
		const words = (text: string) =>
			new Set(
				text
					.toLowerCase()
					.split(/[^a-z0-9]+/)
					.filter((w) => w.length > 3),
			);

		const asked = words(query);
		if (asked.size === 0) return 0;
		const held = words(record.content);

		let shared = 0;
		for (const word of asked) if (held.has(word)) shared++;
		return shared / asked.size;
	},
};

/** Newer counts for more, halving every `halfLifeDays`. */
export function recencyOf(record: MemoryRecord, now: Date, halfLifeDays = 30): number {
	const days = (now.getTime() - record.createdAt.getTime()) / 86_400_000;
	if (days <= 0) return 1;
	return 2 ** (-days / halfLifeDays);
}

/**
 * How much to trust it: where it came from, how sure its author was, and whether
 * anybody else has seen the same thing.
 */
export function reliabilityOf(record: MemoryRecord): number {
	const trust = TRUST[record.origin];
	// Confirmations raise reliability and cannot manufacture it: three workers
	// agreeing about an inference does not make it an observation.
	const confirmed = Math.min(record.confirmations.length, 3) / 3;
	const untrusted = record.fromUntrusted ? 0.7 : 1;
	return trust * (0.6 + 0.4 * confirmed) * record.confidence * untrusted;
}

export interface Scored {
	readonly record: MemoryRecord;
	readonly relevance: number;
	readonly recency: number;
	readonly reliability: number;
	readonly score: number;
	/** Which relevance mechanism produced this. */
	readonly scorer: string;
	/** Whether it made the cut, so the log holds the losers as well. */
	readonly selected: boolean;
}

export interface RankOptions {
	readonly weights?: Weights;
	readonly relevance?: Relevance;
	readonly now?: Date;
	/** How many make it into the context. */
	readonly take?: number;
}

/**
 * Rank everything, and say what happened to all of it.
 *
 * Returns every candidate, scored, with `selected` marking the ones that made
 * the cut. **The ones that did not are the point.** "Why did the worker see this
 * and not that" cannot be answered from the winners alone, and a retrieval that
 * only records what it chose is a retrieval nobody can argue with.
 */
export function rank(
	query: string,
	candidates: readonly MemoryRecord[],
	options: RankOptions = {},
): Scored[] {
	const weights = options.weights ?? EVEN;
	const relevance = options.relevance ?? bySharedWords;
	const now = options.now ?? new Date();
	const take = options.take ?? 5;

	const scored = candidates
		.map((record) => {
			const r = relevance.score(query, record);
			const age = recencyOf(record, now);
			const trust = reliabilityOf(record);
			return {
				record,
				relevance: r,
				recency: age,
				reliability: trust,
				score: r * weights.relevance + age * weights.recency + trust * weights.reliability,
				scorer: relevance.name,
				selected: false,
			};
		})
		.sort((a, b) => b.score - a.score);

	return scored.map((entry, index) => ({ ...entry, selected: index < take }));
}
