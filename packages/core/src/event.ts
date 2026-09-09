/**
 * The Event primitive. 02-CORE §3.5.
 *
 * "An immutable, ordered, attributed record of something that happened."
 *
 * This is the only durable state in Maschina (02-CORE §7). There is
 * deliberately no `update` shape and no `delete` shape anywhere in this file.
 */

/** An event that has been recorded. Has an id and a position in the log. */
export interface Event {
	/** Monotonic. Assigned by the database, never by the caller. */
	readonly id: bigint;
	readonly recordedAt: Date;
	/** Which worker, node, or human caused this. */
	readonly actor: string;
	/** What this was in service of. Null until objectives exist (slice 1). */
	readonly objective: string | null;
	/** What kind of fact this records. Taxonomy in 02-CORE §3.5. */
	readonly type: string;
	readonly payload: Readonly<Record<string, unknown>>;
	/** Lease generation, for fencing. 0 until leases exist (slice 5). */
	readonly epoch: bigint;
	/** The event that caused this one. */
	readonly causation: bigint | null;
}

/**
 * An event about to be recorded. No id and no timestamp: both are the log's to
 * assign, which is what makes ordering something the caller cannot influence.
 */
export interface NewEvent {
	readonly actor: string;
	readonly type: string;
	readonly objective?: string | null;
	readonly payload?: Readonly<Record<string, unknown>>;
	readonly epoch?: bigint;
	readonly causation?: bigint | null;
}

/** Filters for reading the log. Absent fields mean "no constraint". */
export interface ReadOptions {
	readonly objective?: string;
	readonly actor?: string;
	/** Exclusive lower bound on id, for streaming forward from a cursor. */
	readonly after?: bigint;
	readonly limit?: number;
}
