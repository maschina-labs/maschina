/**
 * What a daemon may ask the orchestrator for, and what it gets back.
 *
 * A daemon never touches the database. It asks for work here, and everything it learns about a run
 * arrives in these shapes. Unknown fields are refused, the same as the signer's contract.
 */

import { z } from "zod";

const id = z
	.string()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "not a v7 id");

/** A whole number too large for JSON, carried as digits. */
const whole = z.string().regex(/^\d+$/, "not a whole number");

export const ClaimRequest = z
	.strictObject({
		/** The node asking. Its lease is recorded against this id. */
		nodeId: id,
	})
	.meta({ id: "ClaimRequest" });
export type ClaimRequest = z.infer<typeof ClaimRequest>;

/** A run a node now holds, until the lease expires or it reports back. */
export const LeasedRunBody = z
	.strictObject({
		id,
		machineId: id,
		occurrenceKey: z.string().min(1),
		dueAt: z.iso.datetime(),
		/** Raised on every claim. A report under an older epoch is refused. */
		leaseEpoch: whole,
		leaseExpiresAt: z.iso.datetime(),
	})
	.meta({ id: "LeasedRun" });
export type LeasedRunBody = z.infer<typeof LeasedRunBody>;

/** Either a run, or nothing to do right now. An empty queue is not an error. */
export const ClaimResponse = z
	.strictObject({ run: LeasedRunBody.nullable() })
	.meta({ id: "ClaimResponse" });
export type ClaimResponse = z.infer<typeof ClaimResponse>;
