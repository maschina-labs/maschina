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
import { append, PAYLOAD_V, read } from "./log.ts";

export const OBJECTIVE_STATED = "objective.stated";
export const OBJECTIVE_ADMITTED = "objective.admitted";
export const OBJECTIVE_REJECTED = "objective.rejected";
export const OBJECTIVE_AMENDMENT_REFUSED = "objective.amendment_refused";
export const OBJECTIVE_EVALUATED = "objective.evaluated";
/**
 * A node has taken this objective and is working on it.
 *
 * The difference between `admitted` and `active`, which nothing was writing.
 * Without it a daemon looking for admitted objectives finds the same one every
 * time it looks, takes it again, and never reaches the second. Found by running
 * a daemon for four seconds.
 */
export const OBJECTIVE_TAKEN = "objective.taken";

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
/**
 * Read a stated payload, checking it rather than asserting it.
 *
 * The same fix as `grantedPayload` in `capability.ts`, and it was missed here
 * when that one was done. `event.payload as unknown as StatedPayload` is a lie
 * the compiler believes: the payload comes out of a JSONB column, so its shape
 * is an assumption until something looks.
 *
 * An objective is worse to get wrong than a capability, because the contract is
 * what everything is later judged against. A malformed one folds into an
 * objective with an undefined contract, and evaluation then judges against
 * nothing while reporting verdicts as though it judged something.
 */
function statedPayload(payload: Record<string, unknown>): StatedPayload {
	const statement = payload.statement;
	if (typeof statement !== "string" || statement.length === 0) {
		throw new Error(
			`an objective.stated payload has no usable statement (${String(statement)}), ` +
				"so this objective cannot be folded (01-PRINCIPLES P8).",
		);
	}

	const contract = payload.contract;
	if (typeof contract !== "object" || contract === null || Array.isArray(contract)) {
		throw new Error(
			"an objective.stated payload has no usable contract, and the contract is what " +
				"the objective is judged against. Refusing to fold it.",
		);
	}
	if (!Array.isArray((contract as Record<string, unknown>).criteria)) {
		throw new Error(
			"an objective.stated payload has a contract with no criteria array. A contract " +
				"with nothing to check is how an objective is satisfied vacuously.",
		);
	}

	const constraints = payload.constraints;
	if (constraints !== undefined && (typeof constraints !== "object" || constraints === null)) {
		throw new Error(
			`an objective.stated payload has unusable constraints (${String(constraints)})`,
		);
	}

	return {
		statement,
		contract: contract as StatedPayload["contract"],
		constraints: (constraints ?? {}) as StatedPayload["constraints"],
		parent: typeof payload.parent === "string" ? payload.parent : null,
	};
}

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
			const p = statedPayload(event.payload);
			stated = {
				statement: p.statement,
				contract: p.contract,
				constraints: p.constraints ?? {},
				parent: p.parent ?? null,
				origin: event.actor,
			};
			state = "stated";
		} else if (event.type === OBJECTIVE_TAKEN) {
			// Only from admitted. A verdict has already moved a finished objective
			// somewhere more specific, and taking it again must not walk that back.
			if (state === "admitted") state = "active";
		} else if (event.type === OBJECTIVE_EVALUATED) {
			// The objective becomes whatever the rollup says, and the rollup is a
			// pure function in `@maschina/core`. Recomputing it here would let the
			// stored verdict and the folded state drift apart, and the stored one
			// is what a human read when they decided something.
			const outcome = event.payload.outcome;
			if (typeof outcome === "string") state = outcome as ObjectiveState;
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

/**
 * Claim an objective, so nobody else takes it and the taker can find it again.
 *
 * Written by whatever is scheduling, not by whatever decides. Taking is not
 * judgment: it says a node has this one, and nothing about what will happen to
 * it.
 */
export async function takeObjective(
	pool: Pool,
	objectiveId: string,
	worker: string,
	node: string,
	epoch = 0n,
): Promise<void> {
	await append(pool, {
		actor: worker,
		objective: objectiveId,
		type: OBJECTIVE_TAKEN,
		epoch,
		payload: { v: PAYLOAD_V, objective: objectiveId, worker, node },
	});
}
