/**
 * The capability service. `05-CAPABILITIES` §4.
 *
 * Grant, check at use, revoke. Like everything else, a projection over the log:
 * there is no capabilities table, and a capability's current status is folded
 * from the events that concern it.
 *
 * **Checked at use, never cached at grant.** Every authorization re-reads the
 * log and re-validates: status active, not expired, operation granted, target in
 * scope, and every ancestor still active. That costs a round trip per effect.
 * `01-PRINCIPLES` P3 requires it, and it is what makes the emergency stop
 * actually stop things: revoking the root removes all authority immediately
 * because nothing is holding a cached decision.
 *
 * If this ever becomes the bottleneck the answer is coarser steps, never a
 * cache. `13-ARCHITECTURE` §5.2.
 */

import { randomUUID } from "node:crypto";
import type {
	Approval,
	Authorization,
	AuthorizationRequest,
	Capability,
	CapabilityStatus,
	DenialReason,
	EffectClass,
	FilesystemOperation,
	Limits,
	ResourceKind,
} from "@maschina/core";
import { scopeViolation, withinScope } from "@maschina/core";
import type { Pool } from "pg";
import { append, PAYLOAD_V, read } from "./log.ts";

export const CAPABILITY_GRANTED = "capability.granted";
export const CAPABILITY_DENIED = "capability.denied";
export const CAPABILITY_REVOKED = "capability.revoked";

const NO_LIMITS: Limits = { granted: 0, reserved: 0, settled: 0 };

export interface GrantInput {
	readonly holder: string;
	readonly resource: ResourceKind;
	readonly operations: readonly FilesystemOperation[];
	readonly scope: string;
	readonly effectClass: EffectClass;
	readonly approval: Approval;
	readonly delegationDepth: number;
	readonly parent?: string | null;
	readonly limits?: Limits;
	readonly expiresAt?: string | null;
	/** Who is granting. A human at the root; a worker when delegating. */
	readonly grantedBy: string;
}

/**
 * Grant a capability.
 *
 * Every field in `GrantInput` is required rather than defaulted, including the
 * three `05-CAPABILITIES` §2 calls out as most likely to be skipped under
 * delivery pressure: `effectClass`, `approval` and `delegationDepth`. A
 * capability that does not declare its effect class cannot be granted, because
 * `03-RUNTIME` §3 cannot classify a crash without it. Making them required
 * arguments means that rule is enforced by the compiler rather than remembered.
 */
export async function grant(pool: Pool, input: GrantInput): Promise<Capability> {
	if (input.operations.length === 0) {
		throw new Error("a capability with no operations grants nothing; refusing to create it");
	}
	if (input.delegationDepth < 0) {
		throw new Error("delegationDepth cannot be negative");
	}

	const id = `cap_${randomUUID()}`;
	await append(pool, {
		actor: input.grantedBy,
		type: CAPABILITY_GRANTED,
		payload: {
			v: PAYLOAD_V,
			capabilityId: id,
			parent: input.parent ?? null,
			holder: input.holder,
			resource: input.resource,
			operations: input.operations,
			scope: input.scope,
			limits: input.limits ?? NO_LIMITS,
			effectClass: input.effectClass,
			approval: input.approval,
			expiresAt: input.expiresAt ?? null,
			delegationDepth: input.delegationDepth,
		},
	});

	const capability = await get(pool, id);
	if (!capability) throw new Error(`capability ${id} vanished after being granted`);
	return capability;
}

/**
 * Revoke a capability. Revocation walks down: every descendant goes with it.
 *
 * `05-CAPABILITIES` §4. This is what makes the emergency stop a single action:
 * every capability is a descendant of the root, so revoking the root removes all
 * authority in the system without any worker cooperating.
 */
export async function revoke(
	pool: Pool,
	capabilityId: string,
	actor: string,
	reason: string,
): Promise<string[]> {
	const all = await list(pool);
	const revoked: string[] = [];

	const walk = (id: string): void => {
		revoked.push(id);
		for (const child of all.filter((c) => c.parent === id)) walk(child.id);
	};
	walk(capabilityId);

	for (const id of revoked) {
		await append(pool, {
			actor,
			type: CAPABILITY_REVOKED,
			payload: {
				v: PAYLOAD_V,
				capabilityId: id,
				reason,
				// Recorded so the log explains why a descendant lost authority it
				// was never directly revoked from.
				revokedAsDescendantOf: id === capabilityId ? null : capabilityId,
			},
		});
	}
	return revoked;
}

/**
 * Can this holder do this, to this, right now?
 *
 * Re-validates everything on every call. A denial is appended to the log before
 * this returns, because `05-CAPABILITIES` §10 requires denials to be recorded as
 * prominently as uses, and a worker repeatedly attempting actions it lacks
 * authority for is the clearest available signal of a misconfiguration or a
 * compromise. A system that logs only successes cannot see it.
 *
 * A granted authorization is *not* recorded here. The Intent event that follows
 * carries the capability id, and that is the use record: recording both would
 * put the same fact in the log twice and make "what has been done with this
 * capability" ambiguous about which to count.
 */
export async function authorize(
	pool: Pool,
	request: AuthorizationRequest,
	now: Date = new Date(),
): Promise<Authorization> {
	const capability = await get(pool, request.capabilityId);

	const deny = async (reason: DenialReason, detail: string): Promise<Authorization> => {
		await append(pool, {
			actor: request.holder,
			type: CAPABILITY_DENIED,
			payload: {
				v: PAYLOAD_V,
				capabilityId: request.capabilityId,
				operation: request.operation,
				target: request.target,
				reason,
				detail,
			},
		});
		return { granted: false, reason, detail };
	};

	if (!capability) {
		return deny("no_such_capability", `no capability ${request.capabilityId}`);
	}
	if (capability.status === "revoked") {
		return deny("revoked", "this capability was revoked");
	}
	if (capability.expiresAt !== null && new Date(capability.expiresAt) <= now) {
		return deny("expired", `expired at ${capability.expiresAt}`);
	}
	if (capability.holder !== request.holder) {
		// Holding is the whole mechanism. Acting on someone else's capability is
		// not a permission problem, it is the absence of one.
		return deny("no_such_capability", `${request.holder} does not hold this capability`);
	}
	if (!capability.operations.includes(request.operation)) {
		return deny(
			"operation_not_granted",
			`${request.operation} is not in {${capability.operations.join(", ")}}`,
		);
	}
	if (!withinScope(capability.scope, request.target)) {
		return deny("outside_scope", scopeViolation(capability.scope, request.target));
	}

	// Ancestors last: it is the most expensive check and the least likely to
	// fail, but it must happen, because revoking a parent revokes the subtree and
	// a child row that still says `active` is not authority.
	const all = await list(pool);
	const byId = new Map(all.map((c) => [c.id, c]));
	let cursor = capability.parent;
	while (cursor !== null) {
		const ancestor = byId.get(cursor);
		if (!ancestor) return deny("ancestor_revoked", `ancestor ${cursor} does not exist`);
		if (ancestor.status !== "active") {
			return deny("ancestor_revoked", `ancestor ${cursor} is ${ancestor.status}`);
		}
		cursor = ancestor.parent;
	}

	return { granted: true, capability };
}

interface GrantedPayload {
	capabilityId: string;
	parent: string | null;
	holder: string;
	resource: ResourceKind;
	operations: FilesystemOperation[];
	scope: string;
	limits: Limits;
	effectClass: EffectClass;
	approval: Approval;
	expiresAt: string | null;
	delegationDepth: number;
}

/**
 * Fold a capability's events into its current state.
 *
 * Pure, and exported for the same reason `fold` in `objective.ts` is: a
 * capability has no row anywhere, so if this is wrong the authority model is
 * wrong and nothing else would notice.
 */
export function foldCapability(
	events: readonly { type: string; payload: Record<string, unknown> }[],
	now: Date = new Date(),
): Capability | null {
	let granted: GrantedPayload | null = null;
	let status: CapabilityStatus = "active";

	for (const event of events) {
		const version = typeof event.payload.v === "number" ? event.payload.v : 1;
		if (version > PAYLOAD_V) {
			throw new Error(
				`event payload version ${version} is newer than this reader understands (${PAYLOAD_V}). ` +
					"Update the reader before folding this log.",
			);
		}

		if (event.type === CAPABILITY_GRANTED) {
			granted = event.payload as unknown as GrantedPayload;
			// Deliberately does NOT reset status. Revocation is terminal: a grant
			// event arriving for an already-revoked id must not resurrect it.
			// Otherwise revoking is undone by appending, and since the log is
			// append-only and anyone holding INSERT can append, revocation would
			// be a suggestion rather than a control. A re-grant is a new
			// capability with a new id.
			if (status !== "revoked") status = "active";
		} else if (event.type === CAPABILITY_REVOKED) {
			status = "revoked";
		}
	}

	if (!granted) return null;

	// Expiry is computed rather than recorded, because it is a fact about the
	// clock rather than something that happened. A revoked capability stays
	// revoked: that is a stronger statement than expired and it was deliberate.
	if (status === "active" && granted.expiresAt !== null && new Date(granted.expiresAt) <= now) {
		status = "expired";
	}

	return {
		id: granted.capabilityId,
		parent: granted.parent ?? null,
		holder: granted.holder,
		resource: granted.resource,
		operations: granted.operations,
		scope: granted.scope,
		limits: granted.limits ?? NO_LIMITS,
		effectClass: granted.effectClass,
		approval: granted.approval,
		expiresAt: granted.expiresAt ?? null,
		delegationDepth: granted.delegationDepth,
		status,
	};
}

/** One capability, folded from the log. */
export async function get(pool: Pool, capabilityId: string): Promise<Capability | null> {
	const events = await read(pool);
	const mine = events.filter((e) => e.payload.capabilityId === capabilityId);
	return mine.length > 0 ? foldCapability(mine) : null;
}

/** Every capability, in grant order. */
export async function list(pool: Pool): Promise<Capability[]> {
	const events = await read(pool);

	const byCapability = new Map<string, typeof events>();
	for (const event of events) {
		const id = event.payload.capabilityId;
		if (typeof id !== "string") continue;
		const bucket = byCapability.get(id);
		if (bucket) bucket.push(event);
		else byCapability.set(id, [event]);
	}

	const capabilities: Capability[] = [];
	for (const slice of byCapability.values()) {
		const folded = foldCapability(slice);
		if (folded) capabilities.push(folded);
	}
	return capabilities;
}
