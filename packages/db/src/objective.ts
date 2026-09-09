/**
 * Objectives, as a projection over the event log. 02-CORE §3.1 and §7.
 *
 * There is no objectives table. An objective's current state is folded from the
 * events that concern it, which is why `rebuildable` is not a feature here but
 * the only thing that exists. Delete every projection and this still works.
 *
 * Four events, and between them they are the whole lifecycle this slice covers:
 *
 *   objective.stated              someone stated an intention
 *   objective.admitted            it passed the gate; contract hash frozen
 *   objective.rejected            it did not pass; the reasons are recorded
 *   objective.amendment_refused   someone tried to move the target
 */

import { randomUUID } from "node:crypto";
import type { Constraints, Contract, Objective, ObjectiveState } from "@maschina/core";
import { hashContract, validateContract } from "@maschina/core";
import type { Pool } from "pg";
import { append, read } from "./log.ts";

/**
 * Payload schema version. ADR-006.
 *
 * Every payload carries `v`. A reader handles every version it has ever seen,
 * because an event written in the wrong shape is written in the wrong shape
 * permanently: the log is append-only and there is no migration path.
 *
 * Bump only for a change a reader cannot handle by ignoring it. Adding an
 * optional field is not a new version.
 */
export const PAYLOAD_V = 1;

export const OBJECTIVE_STATED = "objective.stated";
export const OBJECTIVE_ADMITTED = "objective.admitted";
export const OBJECTIVE_REJECTED = "objective.rejected";
export const OBJECTIVE_AMENDMENT_REFUSED = "objective.amendment_refused";

export interface StateObjectiveInput {
	readonly statement: string;
	readonly contract: Contract;
	readonly constraints?: Constraints;
	readonly origin: string;
	readonly parent?: string | null;
}

export interface AdmissionResult {
	readonly objective: Objective;
	/** Empty when admitted. */
	readonly problems: readonly string[];
}

/**
 * State an objective, and admit it if the contract holds.
 *
 * The contract is a required argument rather than an optional field. That is
 * deliberate: STAGE_0_PLAN's instruction for this slice is that a path admitting
 * an objective without a contract must not exist, and the cheapest way to
 * guarantee that is to make it unrepresentable rather than checked.
 *
 * Both outcomes are recorded. A rejection is as much a fact about the world as
 * an admission, and a system that logs only successes cannot show you the
 * contracts people tried to get past the gate.
 */
export async function stateObjective(
	pool: Pool,
	input: StateObjectiveInput,
): Promise<AdmissionResult> {
	const objectiveId = `obj_${randomUUID()}`;
	const constraints = input.constraints ?? {};
	const parent = input.parent ?? null;

	const stated = await append(pool, {
		actor: input.origin,
		type: OBJECTIVE_STATED,
		objective: objectiveId,
		payload: {
			v: PAYLOAD_V,
			statement: input.statement,
			contract: input.contract,
			constraints,
			parent,
		},
	});

	const problems = validateContract(input.contract);

	if (problems.length > 0) {
		await append(pool, {
			actor: input.origin,
			type: OBJECTIVE_REJECTED,
			objective: objectiveId,
			causation: stated.id,
			payload: { v: PAYLOAD_V, problems },
		});
	} else {
		await append(pool, {
			actor: input.origin,
			type: OBJECTIVE_ADMITTED,
			objective: objectiveId,
			causation: stated.id,
			// The hash is computed once, here, and never recomputed from a later
			// contract. Recomputing is how the target moves.
			payload: { v: PAYLOAD_V, contractHash: hashContract(input.contract) },
		});
	}

	const objective = await get(pool, objectiveId);
	if (!objective) throw new Error(`objective ${objectiveId} vanished after being stated`);
	return { objective, problems };
}

/**
 * Attempt to change the contract of an objective that already has one.
 *
 * This always refuses, and the refusal is recorded. It exists so the refusal has
 * a real code path rather than being an absence, which is the difference between
 * a rule and an assumption.
 *
 * 09-EVALUATION §2: a worker that believes the contract is wrong may say so, and
 * that escalates to a human who can abandon the objective and state a better
 * one. Nobody edits a frozen contract, including the human. There is no force
 * flag here on purpose.
 */
export async function amendContract(
	pool: Pool,
	objectiveId: string,
	proposed: Contract,
	actor: string,
): Promise<never> {
	const objective = await get(pool, objectiveId);
	if (!objective) throw new Error(`no such objective: ${objectiveId}`);

	const reason =
		objective.contractHash === null
			? `objective is ${objective.state}, so it has no frozen contract to amend`
			: "the contract was frozen at admission and cannot change";

	await append(pool, {
		actor,
		type: OBJECTIVE_AMENDMENT_REFUSED,
		objective: objectiveId,
		payload: {
			v: PAYLOAD_V,
			reason,
			state: objective.state,
			frozenHash: objective.contractHash,
			attemptedHash: hashContract(proposed),
		},
	});

	throw new Error(
		`Refused: ${reason}. Changing a contract creates a new objective (09-EVALUATION §2).`,
	);
}

interface StatedPayload {
	statement: string;
	contract: Contract;
	constraints: Constraints;
	parent: string | null;
}

/**
 * Fold one objective's events into its current state.
 *
 * Exported because this is the architectural bet in miniature: an objective has
 * no row anywhere, so if this function is wrong the objective is wrong. It is
 * pure, so it is unit tested without a database.
 *
 * Written as separate accumulators rather than repeatedly spreading a partial
 * objective. The spread version reads nicer and does not typecheck: the result
 * is inferred from a value derived from itself.
 */
export function fold(
	events: readonly { type: string; actor: string; payload: Record<string, unknown> }[],
): Objective | null {
	let stated: (StatedPayload & { origin: string }) | null = null;
	let state: ObjectiveState = "stated";
	let contractHash: string | null = null;
	let rejectedReason: string | null = null;

	for (const event of events) {
		// ADR-006 R4: slice 0 and slice 1 wrote events before versioning existed.
		// Absence means version 1 rather than corruption.
		const version = typeof event.payload.v === "number" ? event.payload.v : 1;
		if (version > PAYLOAD_V) {
			// R2 in reverse: a reader that meets a version from the future must
			// stop rather than guess. 01-PRINCIPLES P8, ambiguity blocks.
			throw new Error(
				`event payload version ${version} is newer than this reader understands (${PAYLOAD_V}). ` +
					"Update the reader before folding this log.",
			);
		}

		if (event.type === OBJECTIVE_STATED) {
			const p = event.payload as unknown as StatedPayload;
			stated = {
				statement: p.statement,
				contract: p.contract,
				constraints: p.constraints ?? {},
				parent: p.parent ?? null,
				origin: event.actor,
			};
			state = "stated";
		} else if (event.type === OBJECTIVE_ADMITTED) {
			state = "admitted";
			contractHash = String(event.payload.contractHash);
		} else if (event.type === OBJECTIVE_REJECTED) {
			state = "rejected";
			const problems = event.payload.problems;
			rejectedReason = Array.isArray(problems) ? problems.join("; ") : String(problems);
		}
		// A refusal is recorded and changes nothing. That is the point of it.
	}

	if (!stated) return null;

	return {
		id: "",
		statement: stated.statement,
		contract: stated.contract,
		constraints: stated.constraints,
		origin: stated.origin,
		parent: stated.parent,
		state,
		contractHash,
		rejectedReason,
	};
}

/** One objective, folded from the log. Null if nothing was ever stated for it. */
export async function get(pool: Pool, objectiveId: string): Promise<Objective | null> {
	const events = await read(pool, { objective: objectiveId });
	const folded = fold(events);
	return folded ? { ...folded, id: objectiveId } : null;
}

/** Every objective, oldest first. */
export async function list(pool: Pool): Promise<Objective[]> {
	const events = await read(pool);

	const byObjective = new Map<string, typeof events>();
	for (const event of events) {
		if (event.objective === null) continue;
		const bucket = byObjective.get(event.objective);
		if (bucket) bucket.push(event);
		else byObjective.set(event.objective, [event]);
	}

	const objectives: Objective[] = [];
	for (const [id, slice] of byObjective) {
		const folded = fold(slice);
		if (folded) objectives.push({ ...folded, id });
	}
	return objectives;
}
