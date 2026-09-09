/**
 * Remembering, as events. `07-CONTEXT-MEMORY`.
 *
 * Memory has no table. A record is a fold over what was written down, like an
 * objective or a capability, which is what makes `02-CORE` §7 true of it as
 * well: delete every projection and rebuild, and the beliefs come back exactly
 * as they were.
 *
 * **Nothing is ever deleted.** A record that turns out to be wrong is deprecated
 * by an event saying what contradicted it. Having believed something false is
 * itself worth knowing, and removing it would be editing history
 * (`01-PRINCIPLES` P14).
 */

import { randomUUID } from "node:crypto";
import type { MemoryOrigin, MemoryRecord, MemoryScope } from "@maschina/core";
import { mayPromote } from "@maschina/core";
import type { Pool } from "pg";
import { append, epochFor, PAYLOAD_V, read } from "./log.ts";

export const MEMORY_WRITTEN = "memory.written";
export const MEMORY_CONFIRMED = "memory.confirmed";
export const MEMORY_PROMOTED = "memory.promoted";
export const MEMORY_DEPRECATED = "memory.deprecated";

export interface RememberInput {
	readonly kind: MemoryRecord["kind"];
	readonly content: string;
	readonly origin: MemoryOrigin;
	readonly evidence: readonly string[];
	readonly confidence: number;
	readonly scope: MemoryScope;
	readonly scopeId: string | null;
	readonly author: string;
	/**
	 * Did this come from something nobody vouches for? A repository file, a web
	 * page, command output (`07-CONTEXT-MEMORY` §2).
	 *
	 * Required rather than defaulted. Defaulting it to false would make the
	 * contamination defence opt in, and the one time somebody forgot would be the
	 * time it mattered.
	 */
	readonly fromUntrusted: boolean;
}

/** Write something down. */
export async function remember(pool: Pool, input: RememberInput): Promise<string> {
	if (input.content.trim().length === 0) {
		throw new Error("a memory record with no content remembers nothing");
	}
	if (input.confidence < 0 || input.confidence > 1) {
		throw new Error(`confidence is between 0 and 1, got ${input.confidence}`);
	}
	// A lesson is a generalisation, and one with nothing behind it is a guess
	// that will be read later as though somebody checked.
	if (input.kind === "lesson" && input.evidence.length === 0) {
		throw new Error(
			"a lesson needs evidence. Without it, a guess is filed as something learned and " +
				"read back later as though it had been checked (07-CONTEXT-MEMORY 4).",
		);
	}

	const id = `mem_${randomUUID()}`;
	await append(pool, {
		actor: input.author,
		epoch: await epochFor(pool, input.author),
		type: MEMORY_WRITTEN,
		payload: { v: PAYLOAD_V, memoryId: id, ...input, evidence: [...input.evidence] },
	});
	return id;
}

/** Somebody else saw the same thing. */
export async function confirm(
	pool: Pool,
	memoryId: string,
	by: string,
	evidence: readonly string[],
): Promise<void> {
	await append(pool, {
		actor: by,
		epoch: await epochFor(pool, by),
		type: MEMORY_CONFIRMED,
		payload: { v: PAYLOAD_V, memoryId, by, evidence: [...evidence] },
	});
}

/**
 * Widen what a record counts for.
 *
 * Refused rather than recorded when the rule says no, because a promotion that
 * happened is the thing that matters and a rejected one is not a fact about the
 * world. The refusal is thrown so the caller has to deal with it.
 */
export async function promote(
	pool: Pool,
	memoryId: string,
	to: MemoryScope,
	by: string,
): Promise<void> {
	const record = await getMemory(pool, memoryId);
	if (record === null) throw new Error(`no memory record ${memoryId}`);

	const verdict = mayPromote({ record, to, by });
	if (!verdict.allowed) {
		throw new Error(`${memoryId} cannot be promoted to ${to}: ${verdict.why}`);
	}

	await append(pool, {
		actor: by,
		epoch: await epochFor(pool, by),
		type: MEMORY_PROMOTED,
		payload: { v: PAYLOAD_V, memoryId, from: record.scope, to, by },
	});
}

/** Mark something wrong, and say what showed it. */
export async function deprecate(
	pool: Pool,
	memoryId: string,
	by: string,
	contradictedBy: string,
): Promise<void> {
	if (contradictedBy.trim().length === 0) {
		throw new Error(
			"deprecating a memory needs what contradicted it. Otherwise the record says " +
				"somebody stopped believing it and not why, which is not worth keeping.",
		);
	}
	await append(pool, {
		actor: by,
		epoch: await epochFor(pool, by),
		type: MEMORY_DEPRECATED,
		payload: { v: PAYLOAD_V, memoryId, by, contradictedBy },
	});
}

type LogEvent = { type: string; payload: Record<string, unknown>; recordedAt: Date };

/** Every memory record, folded from what was written. */
export function foldMemory(events: readonly LogEvent[]): MemoryRecord[] {
	const records = new Map<string, MemoryRecord>();

	for (const event of events) {
		const p = event.payload;
		const id = typeof p.memoryId === "string" ? p.memoryId : null;
		if (id === null) continue;

		if (event.type === MEMORY_WRITTEN) {
			records.set(id, {
				id,
				kind: String(p.kind) as MemoryRecord["kind"],
				content: String(p.content ?? ""),
				origin: String(p.origin) as MemoryOrigin,
				evidence: Array.isArray(p.evidence) ? (p.evidence as string[]) : [],
				confidence: typeof p.confidence === "number" ? p.confidence : 0,
				scope: String(p.scope) as MemoryScope,
				scopeId: typeof p.scopeId === "string" ? p.scopeId : null,
				author: String(p.author ?? ""),
				// Absent means untrusted, not trusted. An old record written before
				// the field existed is not evidence that somebody vouched for it.
				fromUntrusted: p.fromUntrusted !== false,
				status: "active",
				contradictedBy: null,
				createdAt: event.recordedAt,
				confirmations: [],
			});
			continue;
		}

		const existing = records.get(id);
		if (existing === undefined) continue;

		if (event.type === MEMORY_CONFIRMED) {
			const by = String(p.by ?? "");
			records.set(id, {
				...existing,
				confirmations: existing.confirmations.includes(by)
					? existing.confirmations
					: [...existing.confirmations, by],
			});
		} else if (event.type === MEMORY_PROMOTED) {
			records.set(id, { ...existing, scope: String(p.to) as MemoryScope });
		} else if (event.type === MEMORY_DEPRECATED) {
			records.set(id, {
				...existing,
				status: "deprecated",
				contradictedBy: String(p.contradictedBy ?? ""),
			});
		}
	}

	return [...records.values()];
}

export async function getMemory(pool: Pool, memoryId: string): Promise<MemoryRecord | null> {
	return foldMemory(await read(pool)).find((r) => r.id === memoryId) ?? null;
}

/**
 * What a worker on an objective can see.
 *
 * Scope decides visibility, and the narrow scopes only match their own id.
 * Deprecated records are left out: they are kept forever and not offered as
 * though still believed.
 */
export async function visibleTo(
	pool: Pool,
	worker: string,
	objective: string | null,
	project: string | null,
): Promise<MemoryRecord[]> {
	// Which id a scope has to match. Global matches everything, and a narrow
	// scope with nothing to match against sees nothing rather than everything,
	// which is the direction to fail in.
	const owner: Record<MemoryScope, string | null | true> = {
		global: true,
		project,
		worker,
		objective,
	};

	return foldMemory(await read(pool)).filter((record) => {
		if (record.status !== "active") return false;
		const required = owner[record.scope];
		if (required === true) return true;
		return required !== null && record.scopeId === required;
	});
}
