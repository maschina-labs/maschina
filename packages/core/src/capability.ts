/**
 * The Capability primitive. 02-CORE §3.3, 05-CAPABILITIES §2.
 *
 * "An unforgeable, transferable, attenuable grant of authority to perform a
 * specific class of action on a specific resource, under specific limits."
 *
 * The test to keep in mind: can a human answer "what is the worst thing this
 * worker can do" by reading a data structure, without reading any code? If not,
 * the design has failed.
 *
 * **A capability is not a permission check.** It is an object that is held. A
 * permission check asks a central authority "may I", which makes authority
 * ambient and makes the check something you can forget. A held capability means
 * the worker either has the object or does not, and there is no code path that
 * acts without one.
 *
 * **There is no tool registry.** A tool is what a capability looks like from the
 * inside (`02-CORE` §4.1). The capability list *is* the tool list. The previous
 * implementation had a `SKILL_CATALOG` gated by subscription tier sitting beside
 * a separate `agentPermissionEnum`, and the drift between them was the hole.
 */

/** What kind of thing authority is held over. Extended as resources are added. */
export type ResourceKind = "filesystem" | "model";

/**
 * What a capability names when the resource is a model. `04-WORKERS` §7.
 *
 * A class, never a vendor's product name, because P6 says a worker definition
 * does not name a vendor. The mapping from class to a concrete model is runtime
 * configuration: when a provider ships something new, one entry changes and
 * every worker benefits, and no capability ever granted has to be rewritten.
 *
 * The log stays concrete even though the grant is abstract. Every invocation
 * records which model actually answered, so "which model made that decision"
 * remains answerable after the mapping changes.
 */
export type ModelClass = "reasoning" | "fast" | "long_context" | "code" | "embedding";

/**
 * What a crash between Intent and Outcome means for this effect.
 * `03-RUNTIME` §3. Required: a capability that does not declare one cannot be
 * granted, because recovery cannot classify a crash without it.
 */
export type EffectClass = "idempotent" | "reconcilable" | "unsafe";

/**
 * How much human confirmation a use needs. `05-CAPABILITIES` §2.
 *
 * This is how autonomy is graduated: trust is raised by changing this field, not
 * by rewriting anything. It is the mechanism that fills the missing middle
 * between approving every action and handing over a shell.
 */
export type Approval = "none" | "first_use" | "every_use";

export type CapabilityStatus = "active" | "expired" | "revoked";

/** Filesystem operations. Enumerated, never a wildcard. */
export type FilesystemOperation = "read" | "write" | "create" | "delete";

/**
 * Model operations. One, and it is deliberate that there is only one.
 *
 * A model call is a decision effect and nothing else. It does not read files,
 * write files, or run commands, whatever the provider offers, because a single
 * step is one decision effect and at most one world effect (`03-RUNTIME` §2).
 * See `ADR-009` §2.2.
 */
export type ModelOperation = "invoke";

/** Every operation any capability can grant. */
export type Operation = FilesystemOperation | ModelOperation;

/**
 * Metered allowances. Three numbers, not one. `05-CAPABILITIES` §3.
 *
 * Available is `granted - reserved - settled`.
 *
 * Grant-time deduction and use-time reservation are different operations on the
 * same field, and an implementation tracking a single running balance will
 * double-count on delegation, lose reservations on crash, or both.
 *
 * **The unit is micro-dollars of list value**, as an integer. Integers because
 * floating point money accumulates error over a long objective and the log is
 * permanent. List value, not spend, because a model call on a subscription bills
 * nothing per call: the number is what the tokens are worth at list price, and
 * `ADR-009` §3 explains why calling that "spend" would put a lie in the log.
 *
 * Filesystem capabilities do not meter anything and carry zeroes.
 */
export interface Limits {
	/** Moved here permanently at grant time. */
	readonly granted: number;
	/** Held against an Intent, released at settlement. */
	readonly reserved: number;
	/** Actually consumed. */
	readonly settled: number;
}

export interface Capability {
	readonly id: string;
	/** The capability this was attenuated from. Null only at root. */
	readonly parent: string | null;
	/** Worker, node, or human identity. */
	readonly holder: string;
	readonly resource: ResourceKind;
	/** The permitted actions, enumerated. Never a wildcard. */
	readonly operations: readonly Operation[];
	/**
	 * The bounded region of the resource. Everything outside it is denied.
	 *
	 * For a filesystem, an absolute path prefix, and containment is the path
	 * comparison in `scope.ts`. For a model, a `ModelClass`, and containment is
	 * equality: a capability for `fast` does not reach `reasoning`.
	 */
	readonly scope: string;
	readonly limits: Limits;
	readonly effectClass: EffectClass;
	readonly approval: Approval;
	/** ISO 8601. Null means no expiry, which only the root grant should use. */
	readonly expiresAt: string | null;
	/** How many further grants are possible. Zero means this cannot delegate. */
	readonly delegationDepth: number;
	readonly status: CapabilityStatus;
}

/** Why a use was refused. Recorded, and as prominent as a use. */
export type DenialReason =
	| "no_such_capability"
	| "revoked"
	| "expired"
	| "operation_not_granted"
	| "outside_scope"
	| "ancestor_revoked"
	/**
	 * The budget is spent. Never retried: `03-RUNTIME` §5 says a budget failure
	 * suspends and escalates, because retrying it can only fail again, and
	 * quietly moving to something cheaper is the silent degradation
	 * `01-PRINCIPLES` forbids.
	 */
	| "limit_exhausted";

export interface AuthorizationRequest {
	readonly capabilityId: string;
	readonly holder: string;
	readonly operation: Operation;
	/**
	 * The specific thing being acted on: an absolute path for a filesystem, a
	 * `ModelClass` for a model.
	 */
	readonly target: string;
}

export type Authorization =
	| { readonly granted: true; readonly capability: Capability }
	| { readonly granted: false; readonly reason: DenialReason; readonly detail: string };
