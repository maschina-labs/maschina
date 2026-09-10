/**
 * Retrieving from memory, and writing down why. `07-CONTEXT-MEMORY` §6.
 *
 * The ranking is pure and lives in `@maschina/core`. This does the two things
 * that need the log: it reads what a worker is allowed to see, and it records
 * what the ranking decided.
 *
 * **The record includes what was not chosen.** A retrieval event that lists only
 * the winners cannot answer "why did the worker see this and not that", which is
 * the question slice 6 exists to make answerable.
 */

import type { MemoryRecord, RankOptions, Scored } from "@maschina/core";
import { rank } from "@maschina/core";
import type { Pool } from "pg";
import { append, epochFor, PAYLOAD_V } from "./log.ts";
import { visibleTo } from "./memory.ts";

export const MEMORY_RETRIEVED = "memory.retrieved";

export interface RetrieveInput {
	readonly worker: string;
	readonly objective: string | null;
	readonly project: string | null;
	/** What the worker is trying to decide. Ranked against this. */
	readonly query: string;
	readonly options?: RankOptions;
}

export interface Retrieval {
	/** What went into the context, best first. */
	readonly selected: readonly MemoryRecord[];
	/** Everything considered, scored, including what did not make it. */
	readonly considered: readonly Scored[];
}

/**
 * Retrieve, and record the ranking.
 *
 * Scope is applied first and is not a scoring signal: something a worker may not
 * see does not become visible by being relevant. That ordering is the
 * contamination defence continuing to hold through retrieval, which is where it
 * would otherwise quietly stop mattering.
 */
export async function retrieve(pool: Pool, input: RetrieveInput): Promise<Retrieval> {
	const candidates = await visibleTo(pool, input.worker, input.objective, input.project);
	const scored = rank(input.query, candidates, input.options);

	await append(pool, {
		actor: input.worker,
		objective: input.objective,
		epoch: await epochFor(pool, input.worker),
		type: MEMORY_RETRIEVED,
		payload: {
			v: PAYLOAD_V,
			worker: input.worker,
			query: input.query,
			scorer: scored[0]?.scorer ?? "none",
			considered: scored.length,
			// Every candidate, not only the chosen ones. The losers are how the
			// question "and not that" gets an answer.
			ranking: scored.map((entry) => ({
				memoryId: entry.record.id,
				selected: entry.selected,
				score: round(entry.score),
				relevance: round(entry.relevance),
				recency: round(entry.recency),
				reliability: round(entry.reliability),
			})),
		},
	});

	return {
		selected: scored.filter((entry) => entry.selected).map((entry) => entry.record),
		considered: scored,
	};
}

/** Four places is plenty, and keeps the log readable. */
function round(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

export interface RankingEntry {
	readonly memoryId: string;
	readonly selected: boolean;
	readonly score: number;
	readonly relevance: number;
	readonly recency: number;
	readonly reliability: number;
}

export interface RecordedRetrieval {
	readonly at: Date;
	readonly worker: string;
	readonly query: string;
	readonly scorer: string;
	readonly ranking: readonly RankingEntry[];
}

/**
 * Why did the worker see this and not that?
 *
 * The eighth question, answered the way the other seven are: by asking rather
 * than by reading code (`05-CAPABILITIES` §10, criterion 9).
 */
export async function whyThatContext(pool: Pool, worker: string): Promise<RecordedRetrieval[]> {
	const { read } = await import("./log.ts");
	return (await read(pool, { actor: worker }))
		.filter((e) => e.type === MEMORY_RETRIEVED)
		.map((e) => ({
			at: e.recordedAt,
			worker: String(e.payload.worker ?? ""),
			query: String(e.payload.query ?? ""),
			scorer: String(e.payload.scorer ?? ""),
			ranking: (e.payload.ranking ?? []) as RankingEntry[],
		}));
}
