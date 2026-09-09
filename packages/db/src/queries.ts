/**
 * The seven questions. `05-CAPABILITIES` §10, `STAGE_0_PLAN` slice 10.
 *
 * Criterion 9 is that these are answered **by query, not by reading code**. That
 * is the difference between a system that records things and a system that can
 * be asked. A log nobody can interrogate is a log nobody reads, and an audit
 * trail that needs a developer and an afternoon is not an audit trail.
 *
 * Every answer here comes from the event log. Nothing is stored to make these
 * fast, and slice 9 measured why that is still affordable.
 */

import type { Capability } from "@maschina/core";
import type { Pool } from "pg";
import { get as getCapability, list as listCapabilities } from "./capability.ts";
import { read } from "./log.ts";

/** 1. What can this worker do right now? */
export interface WorkerAuthority {
	readonly capability: Capability;
	/** False when an ancestor is revoked, whatever this row says about itself. */
	readonly live: boolean;
	readonly available: number;
}

export async function whatCanWorkerDo(pool: Pool, worker: string): Promise<WorkerAuthority[]> {
	const all = await listCapabilities(pool);
	const byId = new Map(all.map((c) => [c.id, c]));

	const liveFor = (capability: Capability): boolean => {
		if (capability.status !== "active") return false;
		let cursor = capability.parent;
		while (cursor !== null) {
			const ancestor = byId.get(cursor);
			if (ancestor === undefined || ancestor.status !== "active") return false;
			cursor = ancestor.parent;
		}
		return true;
	};

	return all
		.filter((c) => c.holder === worker)
		.map((capability) => ({
			capability,
			live: liveFor(capability),
			available:
				capability.limits.granted - capability.limits.reserved - capability.limits.settled,
		}));
}

/**
 * 2. Where did this capability come from, all the way to root?
 *
 * Only answerable since slice 8 gave capabilities a root to trace to. Before
 * that every capability was its own root and this returned one entry, which
 * looked like an answer.
 */
export async function provenanceOf(pool: Pool, capabilityId: string): Promise<Capability[]> {
	const chain: Capability[] = [];
	let cursor: string | null = capabilityId;
	const seen = new Set<string>();

	while (cursor !== null) {
		if (seen.has(cursor)) {
			// A cycle cannot happen through `grant`, which requires the parent to
			// exist before the child. It could happen through a hand-written event,
			// and looping forever while answering a question about authority is a
			// worse outcome than saying the chain is broken.
			throw new Error(`the ancestry of ${capabilityId} loops at ${cursor}`);
		}
		seen.add(cursor);

		const capability: Capability | null = await getCapability(pool, cursor);
		if (capability === null) break;
		chain.push(capability);
		cursor = capability.parent;
	}
	return chain;
}

/** 3. What has been done with this capability? */
export interface CapabilityUse {
	readonly at: Date;
	readonly actor: string;
	readonly type: string;
	readonly operation: string;
	readonly target: string;
	readonly result: string;
}

export async function whatWasDoneWith(
	pool: Pool,
	capabilityId: string,
): Promise<CapabilityUse[]> {
	return (await read(pool))
		.filter((e) => e.payload.capabilityId === capabilityId)
		.map((e) => ({
			at: e.recordedAt,
			actor: e.actor,
			type: e.type,
			operation: String(e.payload.operation ?? ""),
			target: String(e.payload.target ?? ""),
			result: String(e.payload.result ?? e.payload.reason ?? ""),
		}));
}

/**
 * 4. What has been denied, and to whom?
 *
 * `05-CAPABILITIES` §10: denials are recorded as prominently as uses. This is
 * the query that makes that true rather than merely stated, because a denial
 * nobody can find is a denial nobody acts on.
 */
export interface Denial {
	readonly at: Date;
	readonly holder: string;
	readonly capabilityId: string;
	readonly operation: string;
	readonly target: string;
	readonly reason: string;
	readonly detail: string;
}

export async function whatWasDenied(pool: Pool, holder?: string): Promise<Denial[]> {
	return (await read(pool))
		.filter((e) => e.type === "capability.denied")
		.filter((e) => holder === undefined || e.actor === holder)
		.map((e) => ({
			at: e.recordedAt,
			holder: e.actor,
			capabilityId: String(e.payload.capabilityId ?? ""),
			operation: String(e.payload.operation ?? ""),
			target: String(e.payload.target ?? ""),
			reason: String(e.payload.reason ?? ""),
			detail: String(e.payload.detail ?? ""),
		}));
}

/**
 * 5. What would be revoked if I revoked this?
 *
 * Asked before pulling the lever, not after. The emergency stop revokes the root
 * and everything under it, and "everything under it" should be something a human
 * can look at first.
 */
export async function whatWouldRevoking(
	pool: Pool,
	capabilityId: string,
): Promise<Capability[]> {
	const all = await listCapabilities(pool);
	const doomed: Capability[] = [];

	const walk = (id: string): void => {
		const capability = all.find((c) => c.id === id);
		if (capability === undefined) return;
		doomed.push(capability);
		for (const child of all.filter((c) => c.parent === id)) walk(child.id);
	};
	walk(capabilityId);
	return doomed;
}

/**
 * 6. What did this objective cost, by resource?
 *
 * In micro-dollars of list value, which is the unit the log records. Read from
 * settlements rather than from anything a worker reported about itself.
 */
export interface ObjectiveCost {
	readonly resource: string;
	readonly settled: number;
	readonly calls: number;
}

export async function whatDidItCost(pool: Pool, objective: string): Promise<ObjectiveCost[]> {
	const events = await read(pool);
	const capabilities = new Map((await listCapabilities(pool)).map((c) => [c.id, c]));

	// Which capabilities this objective actually used, from its own effects.
	const used = new Set(
		events
			.filter((e) => e.objective === objective && typeof e.payload.capabilityId === "string")
			.map((e) => String(e.payload.capabilityId)),
	);

	const byResource = new Map<string, { settled: number; calls: number }>();
	for (const event of events) {
		if (event.type !== "capability.settled") continue;
		const id = String(event.payload.capabilityId ?? "");
		if (!used.has(id)) continue;

		const resource = capabilities.get(id)?.resource ?? "unknown";
		const amount = typeof event.payload.amount === "number" ? event.payload.amount : 0;
		const running = byResource.get(resource) ?? { settled: 0, calls: 0 };
		byResource.set(resource, { settled: running.settled + amount, calls: running.calls + 1 });
	}

	return [...byResource.entries()].map(([resource, totals]) => ({ resource, ...totals }));
}

/**
 * 7. Why did the worker make this decision?
 *
 * Provenance by reference, not by copy. The answer is the worker's recorded
 * reasoning plus the ids of the events around it, so an auditor reads the same
 * history the worker acted on rather than a summary somebody wrote afterwards.
 */
export interface DecisionProvenance {
	readonly decisionId: bigint;
	readonly at: Date;
	readonly worker: string;
	readonly objective: string | null;
	readonly reasoning: string;
	/** The Intent this decision led to, if it got that far. */
	readonly intentId: bigint | null;
	readonly outcomeId: bigint | null;
	readonly result: string | null;
	/** Everything already in the log for this objective when the decision was made. */
	readonly sawEventsUpTo: bigint;
}

export async function whyDidItDecide(
	pool: Pool,
	decisionId: bigint,
): Promise<DecisionProvenance | null> {
	const events = await read(pool);
	const decision = events.find((e) => e.id === decisionId && e.type === "worker.decided");
	if (decision === undefined) return null;

	const intent = events.find(
		(e) => e.type === "effect.intended" && e.causation === decision.id,
	);
	const outcome =
		intent === undefined
			? undefined
			: events.find((e) => e.type === "effect.outcome" && e.causation === intent.id);

	return {
		decisionId: decision.id,
		at: decision.recordedAt,
		worker: decision.actor,
		objective: decision.objective,
		reasoning: String(decision.payload.reasoning ?? ""),
		intentId: intent?.id ?? null,
		outcomeId: outcome?.id ?? null,
		result: outcome === undefined ? null : String(outcome.payload.result ?? ""),
		// By reference: the boundary of what existed, not a copy of it.
		sawEventsUpTo: decision.id - 1n,
	};
}
