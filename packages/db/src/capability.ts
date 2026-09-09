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
	CheckpointProcedure,
	DenialReason,
	EffectClass,
	Limits,
	Operation,
	ResourceKind,
} from "@maschina/core";
import { scopeViolationOf, withinScopeOf } from "@maschina/core";
import type { Pool } from "pg";
import { append, PAYLOAD_V, read } from "./log.ts";

export const CAPABILITY_GRANTED = "capability.granted";
export const CAPABILITY_DENIED = "capability.denied";
export const CAPABILITY_REVOKED = "capability.revoked";
/**
 * A reservation is held against an Intent and released at settlement.
 * `05-CAPABILITIES` §3, `10-RESOURCES-AND-ECONOMY` §3.
 *
 * Two events rather than one, because the point of three numbers is that a
 * process which dies holding a reservation leaves the reservation visible in the
 * log. A single running balance decremented at the end loses it exactly when it
 * matters: the crash. This is the same shape as Intent and Outcome, for the same
 * reason.
 */
export const CAPABILITY_RESERVED = "capability.reserved";
export const CAPABILITY_SETTLED = "capability.settled";

const NO_LIMITS: Limits = { granted: 0, reserved: 0, settled: 0 };

export interface GrantInput {
	readonly holder: string;
	readonly resource: ResourceKind;
	readonly operations: readonly Operation[];
	readonly scope: string;
	readonly effectClass: EffectClass;
	readonly checkpoint: CheckpointProcedure;
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
			checkpoint: input.checkpoint,
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
/**
 * Hold budget against an Intent. `05-CAPABILITIES` §3.
 *
 * Taken before the effect runs and released at settlement. The amount is an
 * estimate, because at this point nobody knows what the call will cost, and
 * reserving nothing until the bill arrives is how a budget gets overrun by the
 * one call that mattered.
 */
export async function reserve(
	pool: Pool,
	capabilityId: string,
	actor: string,
	amount: number,
): Promise<void> {
	await append(pool, {
		actor,
		type: CAPABILITY_RESERVED,
		payload: { v: PAYLOAD_V, capabilityId, amount },
	});
}

/**
 * Release a reservation and record what was actually consumed.
 *
 * Both numbers, because they are different facts. `reserved` says how much to
 * hand back and `amount` says what it cost, and a settlement carrying only one
 * of them either leaks the difference out of the budget forever or hides an
 * overspend. See the tests in `capability.test.ts` for both failures.
 */
export async function settle(
	pool: Pool,
	capabilityId: string,
	actor: string,
	amount: number,
	reserved: number,
): Promise<void> {
	await append(pool, {
		actor,
		type: CAPABILITY_SETTLED,
		payload: { v: PAYLOAD_V, capabilityId, amount, reserved },
	});
}

/**
 * Does this kind of resource cost anything to use?
 *
 * A filesystem capability carries zeroes in `limits`, so checking availability
 * on one would refuse every write: `0 - 0 - 0` is not greater than zero. The
 * question is about the resource, not about the numbers, so it is asked that
 * way rather than inferred from a granted value being non zero.
 */
function meters(resource: ResourceKind): boolean {
	return resource === "model";
}

/**
 * The least a use of this resource can cost, in micro-dollars of list value.
 *
 * A budget with less than this left is exhausted, even though the number is
 * still positive. Without it a worker holding a few micro-dollars attempts a
 * call, the provider refuses it for having no budget, the refusal consumes
 * nothing, the balance is untouched, and the same call can be attempted again
 * forever. That livelock is what `03-RUNTIME` §5 forbids when it says a budget
 * failure suspends and escalates rather than being retried.
 *
 * Found by writing the proof for the exhaustion criterion and watching it never
 * exhaust. Measured rather than guessed: a contained call to the cheapest model
 * class settles around 1,600, so this is roughly a call and a half.
 */
const MINIMUM_CHARGE: Partial<Record<ResourceKind, number>> = { model: 2_500 };

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
	if (!withinScopeOf(capability.resource, capability.scope, request.target)) {
		return deny(
			"outside_scope",
			scopeViolationOf(capability.resource, capability.scope, request.target),
		);
	}
	if (meters(capability.resource)) {
		// Three numbers, not one (`05-CAPABILITIES` §3). A single running balance
		// loses reservations when a process dies holding them, which is exactly
		// when the number matters most.
		const { granted, reserved, settled } = capability.limits;
		const available = granted - reserved - settled;
		const floor = MINIMUM_CHARGE[capability.resource] ?? 1;
		if (available < floor) {
			return deny(
				"limit_exhausted",
				`${available} left, and the cheapest use costs about ${floor}: ` +
					`granted ${granted}, reserved ${reserved}, settled ${settled}`,
			);
		}
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
	operations: Operation[];
	scope: string;
	limits: Limits;
	effectClass: EffectClass;
	checkpoint: CheckpointProcedure;
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
/**
 * Read a whole number of micro-dollars out of a payload.
 *
 * Throws rather than defaulting to zero. A reservation event whose amount cannot
 * be read is not a free reservation, it is an unreadable one, and P8 says
 * ambiguity blocks. Defaulting would silently hand back budget nobody released.
 */
function amountOf(payload: Record<string, unknown>, field = "amount"): number {
	const value = payload[field];
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		throw new Error(
			`${field} in a limits event must be a whole number of micro-dollars, got ${String(value)}`,
		);
	}
	return value;
}

export function foldCapability(
	events: readonly { type: string; payload: Record<string, unknown> }[],
	now: Date = new Date(),
): Capability | null {
	let granted: GrantedPayload | null = null;
	let status: CapabilityStatus = "active";
	let reserved = 0;
	let settled = 0;

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
		} else if (event.type === CAPABILITY_RESERVED) {
			reserved += amountOf(event.payload);
		} else if (event.type === CAPABILITY_SETTLED) {
			// The reservation is released and the actual cost moves to settled.
			// Released by the amount reserved, not by the amount spent: if a call
			// cost less than reserved the difference has to come back, and if it
			// cost more the overspend still lands in settled where it is visible.
			reserved -= amountOf(event.payload, "reserved");
			settled += amountOf(event.payload);
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
		limits: {
			granted: (granted.limits ?? NO_LIMITS).granted,
			reserved,
			settled,
		},
		effectClass: granted.effectClass,
		// Absent on grants written before the field existed (ADR-006 R4). Read as
		// `none`, which is what those capabilities actually were: a filesystem
		// write inside a scope is already in the world, and a model call leaves
		// nothing on the node at all. Not a convenience default.
		checkpoint: granted.checkpoint ?? "none",
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
