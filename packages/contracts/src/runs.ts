/**
 * What a daemon may ask the orchestrator for, and what it gets back.
 *
 * A daemon never touches the database. It asks for work here, and everything it learns about a run
 * arrives in these shapes. Unknown fields are refused, the same as the signer's contract.
 */

import { z } from "zod";
import { eventPayload } from "./events.ts";
import { SignRequest } from "./signing.ts";

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

/**
 * What a node may report about a run it holds: that it started, that it skipped, or how it finished.
 * Trades are never reported here. They go to the signer, through the orchestrator, on their own path.
 */
export const RunReportEvent = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("run.started"), payload: eventPayload("run.started") }),
	z.strictObject({ type: z.literal("run.skipped"), payload: eventPayload("run.skipped") }),
	z.strictObject({ type: z.literal("run.finished"), payload: eventPayload("run.finished") }),
]);
export type RunReportEvent = z.infer<typeof RunReportEvent>;

export const ReportRequest = z
	.strictObject({
		nodeId: id,
		runId: id,
		/** The epoch the node was given when it claimed the run. */
		leaseEpoch: whole,
		event: RunReportEvent,
	})
	.meta({ id: "ReportRequest" });
export type ReportRequest = z.infer<typeof ReportRequest>;

export const ReportResponse = z
	.strictObject({ recorded: z.literal(true) })
	.meta({ id: "ReportResponse" });
export type ReportResponse = z.infer<typeof ReportResponse>;

/** A node asking about a run it holds. */
export const RunContextRequest = z
	.strictObject({ nodeId: id, runId: id, leaseEpoch: whole })
	.meta({ id: "RunContextRequest" });
export type RunContextRequest = z.infer<typeof RunContextRequest>;

/** What a node needs to run the machine. Balances it reads from the chain itself. */
export const RunContextResponse = z
	.strictObject({
		runId: id,
		machineId: id,
		wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "not an address"),
		kind: z.string().min(1),
		settings: z.unknown(),
		dueAt: z.iso.datetime(),
		state: z.string().min(1),
		canAct: z.boolean(),
		availableBudget: whole,
		totals: z.strictObject({ spent: whole, buys: z.int().nonnegative() }),
	})
	.meta({ id: "RunContextResponse" });
export type RunContextResponse = z.infer<typeof RunContextResponse>;
/** A node proposing a trade for a run it holds. The orchestrator checks the lease and asks the signer. */
export const ProposeRequest = z
	.strictObject({ nodeId: id, leaseEpoch: whole, proposal: SignRequest })
	.meta({ id: "ProposeRequest" });
export type ProposeRequest = z.infer<typeof ProposeRequest>;

/** A node keeping its hold on a run while the run is still working. */
export const RenewRequest = z
	.strictObject({ nodeId: id, runId: id, leaseEpoch: whole })
	.meta({ id: "RenewRequest" });
export type RenewRequest = z.infer<typeof RenewRequest>;

export const RenewResponse = z
	.strictObject({ leaseExpiresAt: z.iso.datetime() })
	.meta({ id: "RenewResponse" });
export type RenewResponse = z.infer<typeof RenewResponse>;
