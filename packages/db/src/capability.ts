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
import { changesTheWorld, scopeViolationOf, withinScopeOf } from "@maschina/core";
import type { Pool } from "pg";
import { append, epochFor, PAYLOAD_V, read } from "./log.ts";

export const CAPABILITY_GRANTED = "capability.granted";
export const CAPABILITY_DENIED = "capability.denied";
export const CAPABILITY_REVOKED = "capability.revoked";
/**
 * Approval. `05-CAPABILITIES` §2.
 *
 * "This is how autonomy is graduated: trust is raised by changing this field,
 * not by rewriting anything. It is the mechanism that fills the missing middle
 * between approving every action and handing over a shell."
 *
 * It was a field on every capability that nothing ever read. The authorize path
 * performed nine checks and this was not one of them, so a capability marked
 * `every_use` was acted on without anybody being asked, including the root.
 *
 * Three events make it real. A use that needs approval and has none is denied
 * and the request is recorded, so a human has something to answer. An approval
 * is recorded when they answer. A use that consumed one is recorded, so an
 * `every_use` approval cannot be spent twice.
 */
export const CAPABILITY_APPROVAL_REQUESTED = "capability.approval_requested";
export const CAPABILITY_APPROVED = "capability.approved";
export const CAPABILITY_USE_APPROVED = "capability.use_approved";
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
/**
 * Did this actor work on this objective?
 *
 * Used to refuse evaluation authority to the worker that executed. Read from the
 * log, because that is the only record of who actually did anything, and a
 * worker's own claim about it is exactly what should not be trusted here.
 *
 * **Only world effects count.** `03-RUNTIME` §2 separates the decision from the
 * world effect, and the rule in `09-EVALUATION` §4 is about having *executed* an
 * objective, not having thought about it.
 *
 * Both halves of that were learned the hard way. Counting `worker.decided` meant
 * the act of deciding to judge disqualified the judge. Then counting the model
 * call meant an evaluator that used a model to form its opinion had, by that
 * definition, worked on the objective, and was refused when it went to record
 * the verdict. An evaluator that may not think cannot judge.
 *
 * Writing a file or pushing a commit is working on it. Asking a model and
 * recording a verdict are not.
 */
async function executedObjective(
	pool: Pool,
	actor: string,
	objective: string,
): Promise<boolean> {
	// Only effects that changed something outside Maschina. `03-RUNTIME` §2
	// separates the decision from the world effect, and this is the difference
	// between having worked on an objective and having thought about it.
	const worldEffects = (["read", "write", "create", "delete", "commit"] as Operation[]).filter(
		changesTheWorld,
	);

	const result = await pool.query<{ n: string }>(
		`SELECT count(*)::text AS n FROM events
     WHERE actor = $1 AND objective = $2
       AND type IN ('effect.intended', 'effect.outcome')
       AND payload->>'operation' = ANY($3)`,
		[actor, objective, worldEffects],
	);
	return Number(result.rows[0]?.n ?? "0") > 0;
}

/**
 * The holder of the root capability. Not a worker, and never a worker.
 *
 * `12-SECURITY` §5: the root is never held by a worker and never present on a
 * node. A distinct holder means an ordinary request from any worker fails the
 * holder check before anything else is considered.
 */
export const ROOT_HOLDER = "root";

/**
 * Find the root, or make it. `03-RUNTIME` §6.
 *
 * Idempotent, because a second root is worse than none: the emergency stop would
 * miss half the system while appearing to work.
 */
export async function ensureRoot(pool: Pool): Promise<Capability> {
	const roots = (await list(pool)).filter((c) => c.holder === ROOT_HOLDER && c.parent === null);
	const active = roots.find((c) => c.status === "active");
	if (active !== undefined) return active;

	if (roots.length > 0) {
		// An emergency stop revoked the root, and this would quietly mint a new
		// one. That is how a stop stops being a stop: nobody lifts it, the next
		// grant simply works again, and the system is running while the log says
		// it was halted.
		//
		// Found by proving it. The stop worked, then the very next grant restored
		// authority with nobody deciding to.
		throw new Error(
			"the root capability is revoked, so Maschina is stopped. Granting would " +
				"silently restart it. Lifting an emergency stop is a deliberate act: " +
				"call liftEmergencyStop, which records who lifted it and why.",
		);
	}

	return grant(pool, {
		holder: ROOT_HOLDER,
		resource: "objective",
		// The root grants nothing usable. It exists to be an ancestor, and giving
		// it real operations would make the thing nobody may hold also the most
		// dangerous thing to hold.
		operations: ["evaluate"],
		scope: "root",
		effectClass: "unsafe",
		checkpoint: "none",
		approval: "every_use",
		delegationDepth: 8,
		grantedBy: "human:ash",
		// The one capability with no parent. Everything else descends from it.
		parent: null,
	});
}

export async function grant(pool: Pool, input: GrantInput): Promise<Capability> {
	if (input.operations.length === 0) {
		throw new Error("a capability with no operations grants nothing; refusing to create it");
	}
	if (input.delegationDepth < 0) {
		throw new Error("delegationDepth cannot be negative");
	}
	if (input.parent !== undefined && input.parent !== null) {
		// `04-WORKERS` §5: delegation attenuates only, narrower on every dimension
		// and with the depth decremented. The field was validated and never
		// enforced, which made it a number describing an intention.
		const parentCapability = await get(pool, input.parent);
		if (parentCapability === null) {
			throw new Error(`cannot descend from ${input.parent}, which does not exist`);
		}
		if (parentCapability.delegationDepth <= 0) {
			throw new Error(
				`${input.parent} has no delegation left (depth 0), so it cannot be a parent. ` +
					"Depth is the bound on how far authority can travel from where it started.",
			);
		}
		if (input.delegationDepth >= parentCapability.delegationDepth) {
			throw new Error(
				`a child cannot have depth ${input.delegationDepth} under a parent of depth ` +
					`${parentCapability.delegationDepth}: delegation attenuates, it does not widen.`,
			);
		}
	}
	if (input.resource === "objective" && input.operations.includes("evaluate")) {
		// `09-EVALUATION` §4: "the capability to mark an objective accomplished is
		// never held by the worker pursuing it". Never *held*, so the refusal
		// belongs here rather than only at use. A capability that exists and is
		// refused every time is a capability somebody will eventually find a way
		// to use.
		if (await executedObjective(pool, input.holder, input.scope)) {
			throw new Error(
				`${input.holder} worked on ${input.scope}, so it cannot be granted authority to ` +
					"judge it (09-EVALUATION 4). Evaluation is done by a worker that did not execute.",
			);
		}
	}

	// Everything descends from the root, so that revoking the root really does
	// remove all authority (`03-RUNTIME` §6). Omitting a parent attaches to the
	// root; only the root itself passes `parent: null` on purpose. Before this,
	// every capability was its own root and the emergency stop would have
	// revoked exactly one of them.
	const parent =
		input.parent === undefined
			? input.holder === ROOT_HOLDER
				? null
				: (await ensureRoot(pool)).id
			: input.parent;

	const id = `cap_${randomUUID()}`;
	await append(pool, {
		actor: input.grantedBy,
		type: CAPABILITY_GRANTED,
		payload: {
			v: PAYLOAD_V,
			capabilityId: id,
			parent,
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
		epoch: await epochFor(pool, actor),
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
		epoch: await epochFor(pool, actor),
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
function minimumCharge(resource: ResourceKind): number {
	// Overridable, because it is a measurement of what a provider charges rather
	// than a fact about Maschina, and providers change their prices.
	const configured = process.env.MASCHINA_MINIMUM_MODEL_CHARGE;
	const floor = configured === undefined || configured === "" ? 2_500 : Number(configured);
	if (!Number.isInteger(floor) || floor < 1) {
		throw new Error(
			`MASCHINA_MINIMUM_MODEL_CHARGE must be a whole number of micro-dollars, got ${configured}`,
		);
	}
	return resource === "model" ? floor : 1;
}

/**
 * How many approvals stand against a capability, and how many were spent.
 *
 * Read from the log rather than tracked in a column, because a count kept
 * anywhere else can disagree with the log, and the log is what a human read when
 * they decided to approve something.
 */
async function approvalState(
	pool: Pool,
	capabilityId: string,
): Promise<{ approvals: number; consumed: number }> {
	const result = await pool.query<{ type: string; n: string }>(
		`SELECT type, count(*)::text AS n FROM events
     WHERE payload->>'capabilityId' = $1 AND type IN ($2, $3)
     GROUP BY type`,
		[capabilityId, CAPABILITY_APPROVED, CAPABILITY_USE_APPROVED],
	);
	let approvals = 0;
	let consumed = 0;
	for (const row of result.rows) {
		if (row.type === CAPABILITY_APPROVED) approvals = Number(row.n);
		if (row.type === CAPABILITY_USE_APPROVED) consumed = Number(row.n);
	}
	return { approvals, consumed };
}

/**
 * A human says yes. `05-CAPABILITIES` §2.
 *
 * One call authorises one use of an `every_use` capability, or unlocks a
 * `first_use` one permanently. Deliberately not a flag on the capability: an
 * approval is something that happened, at a time, by someone, and belongs in the
 * log like every other fact.
 */
export async function approveUse(
	pool: Pool,
	capabilityId: string,
	approver: string,
	reason: string,
): Promise<void> {
	await append(pool, {
		actor: approver,
		type: CAPABILITY_APPROVED,
		payload: { v: PAYLOAD_V, capabilityId, approver, reason },
	});
}

export async function authorize(
	pool: Pool,
	request: AuthorizationRequest,
	now: Date = new Date(),
): Promise<Authorization> {
	const capability = await get(pool, request.capabilityId);

	const deny = async (reason: DenialReason, detail: string): Promise<Authorization> => {
		// At the holder's current epoch, not at zero.
		//
		// A denial is written by the control plane about a worker, in that
		// worker's name. Written at epoch 0 it is a write from a generation older
		// than the worker's lease, and the fence rejects it: once any worker held
		// a lease, every denial for it failed and the request returned a 500.
		// Found the first time three workers ran at once.
		await append(pool, {
			actor: request.holder,
			epoch: await epochFor(pool, request.holder),
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
	if (
		capability.resource === "objective" &&
		request.operation === "evaluate" &&
		(await executedObjective(pool, request.holder, request.target))
	) {
		// The same rule again, at use. The grant-time check stops the capability
		// existing; this stops one that was granted before the holder started
		// working on the objective from being used afterwards. Neither check
		// covers the other's case.
		return deny(
			"self_evaluation",
			`${request.holder} worked on ${request.target} and cannot judge it`,
		);
	}
	if (!withinScopeOf(capability.resource, capability.scope, request.target)) {
		return deny(
			"outside_scope",
			scopeViolationOf(capability.resource, capability.scope, request.target),
		);
	}
	if (capability.approval !== "none") {
		const standing = await approvalState(pool, capability.id);
		const approved =
			capability.approval === "first_use"
				? standing.approvals > 0
				: standing.approvals > standing.consumed;

		if (!approved) {
			await append(pool, {
				actor: request.holder,
				type: CAPABILITY_APPROVAL_REQUESTED,
				payload: {
					v: PAYLOAD_V,
					capabilityId: capability.id,
					holder: request.holder,
					operation: request.operation,
					target: request.target,
					approval: capability.approval,
				},
			});
			return deny(
				"approval_required",
				`${capability.approval} approval is required for ${request.operation} on ${request.target}, ` +
					"and none is standing",
			);
		}

		if (capability.approval === "every_use") {
			// Spend it, so one answer authorises one action. Recorded before the
			// authorization returns, so a crash cannot lose the consumption and
			// hand the same approval out twice.
			await append(pool, {
				actor: request.holder,
				type: CAPABILITY_USE_APPROVED,
				payload: {
					v: PAYLOAD_V,
					capabilityId: capability.id,
					operation: request.operation,
					target: request.target,
				},
			});
		}
	}

	if (meters(capability.resource)) {
		// Three numbers, not one (`05-CAPABILITIES` §3). A single running balance
		// loses reservations when a process dies holding them, which is exactly
		// when the number matters most.
		const { granted, reserved, settled } = capability.limits;
		const available = granted - reserved - settled;
		const floor = minimumCharge(capability.resource);
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

/**
 * Read a grant payload, checking it rather than asserting it.
 *
 * `event.payload as unknown as GrantedPayload` was a lie the compiler believed.
 * The payload comes out of a JSONB column, so its shape is an assumption until
 * something looks, and a malformed one folded into a capability with undefined
 * operations and an undefined scope. That capability would then be compared
 * against a target and refuse everything, or worse, and nothing would say why.
 *
 * ADR-006 already checks the version number. A version is not a shape.
 */
function grantedPayload(payload: Record<string, unknown>): GrantedPayload {
	const wrong = (field: string, saw: unknown): never => {
		throw new Error(
			`a capability.granted payload has an unusable ${field} (${String(saw)}). ` +
				"The log cannot be repaired, so this capability cannot be folded and " +
				"nothing may act on it (01-PRINCIPLES P8).",
		);
	};

	const text = (field: string): string => {
		const value = payload[field];
		return typeof value === "string" && value.length > 0 ? value : wrong(field, value);
	};

	const operations = payload.operations;
	if (!Array.isArray(operations) || operations.length === 0) wrong("operations", operations);
	if (!(operations as unknown[]).every((o) => typeof o === "string")) {
		wrong("operations", operations);
	}

	const limits = payload.limits;
	if (limits !== undefined && limits !== null) {
		const l = limits as Record<string, unknown>;
		for (const field of ["granted", "reserved", "settled"]) {
			if (typeof l[field] !== "number") wrong(`limits.${field}`, l[field]);
		}
	}

	const depth = payload.delegationDepth;
	if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 0) {
		wrong("delegationDepth", depth);
	}

	return {
		capabilityId: text("capabilityId"),
		parent: typeof payload.parent === "string" ? payload.parent : null,
		holder: text("holder"),
		resource: text("resource") as GrantedPayload["resource"],
		operations: operations as GrantedPayload["operations"],
		scope: text("scope"),
		limits: (limits ?? NO_LIMITS) as GrantedPayload["limits"],
		effectClass: text("effectClass") as GrantedPayload["effectClass"],
		checkpoint: (typeof payload.checkpoint === "string"
			? payload.checkpoint
			: "none") as GrantedPayload["checkpoint"],
		approval: text("approval") as GrantedPayload["approval"],
		expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : null,
		delegationDepth: depth as number,
	};
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
			granted = grantedPayload(event.payload);
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
