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
export type ResourceKind = "filesystem";

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
 * Metered allowances. Three numbers, not one. `05-CAPABILITIES` §3.
 *
 * Available is `granted - reserved - settled`.
 *
 * Grant-time deduction and use-time reservation are different operations on the
 * same field, and an implementation tracking a single running balance will
 * double-count on delegation, lose reservations on crash, or both.
 *
 * Unused at slice 2, which has no metered resource. Present because the shape
 * has to be right before anything depends on it.
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
	readonly operations: readonly FilesystemOperation[];
	/**
	 * The bounded region of the resource. For a filesystem, an absolute path
	 * prefix. Everything outside it is denied.
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
	| "ancestor_revoked";

export interface AuthorizationRequest {
	readonly capabilityId: string;
	readonly holder: string;
	readonly operation: FilesystemOperation;
	/** The specific thing being acted on. An absolute path, for a filesystem. */
	readonly target: string;
}

export type Authorization =
	| { readonly granted: true; readonly capability: Capability }
	| { readonly granted: false; readonly reason: DenialReason; readonly detail: string };
