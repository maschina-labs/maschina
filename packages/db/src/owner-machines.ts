/**
 * What an owner can see and do with their machines.
 *
 * Every question here is asked as "this owner's machine with this id", in one statement, so a machine
 * that is not theirs is not found rather than refused with a hint. An id in a request is never
 * authority: the owner comes from the session, and the database decides whether the two go together.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import {
	allowedActions,
	budgetMintOf,
	KNOWN_KINDS,
	type MachineAction,
	type MachineState,
	machineBudget,
	machineLimits,
	machineState,
	transition,
} from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Database, Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";
import { appendEvent } from "./record.ts";

export type OwnedMachine = {
	machineId: string;
	name: string;
	kind: string;
	walletAddress: string;
	createdAt: Date;
	state: MachineState;
	stateReason?: string;
	budget: { granted: bigint; reserved: bigint; settled: bigint; available: bigint };
};

export type OwnedMachineDetail = OwnedMachine & {
	settings: unknown;
	limits: {
		maxPerTrade?: bigint | undefined;
		maxPerDay?: bigint | undefined;
		approvedMints: readonly string[];
	};
	/** What the owner may do with it right now, from the lifecycle rules. */
	actions: MachineAction[];
};

type Row = {
	id: string;
	name: string;
	kind: string;
	settings: unknown;
	wallet_address: string;
	created_at: string | Date;
};

const asDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

async function summarise(db: Executor, row: Row): Promise<OwnedMachine> {
	const events = await readMachineEvents(db, row.id);
	const status = machineState(events);
	// Money that came back in the machine's own currency returns to its budget, so the kind is asked
	// which currency that is. A kind that never sells anything back says nothing and nothing changes.
	const budgetMint = budgetMintOf(KNOWN_KINDS, row.kind, row.settings);
	const budget = machineBudget(events, budgetMint === undefined ? {} : { budgetMint });
	return {
		machineId: row.id,
		name: row.name,
		kind: row.kind,
		walletAddress: row.wallet_address,
		createdAt: asDate(row.created_at),
		state: status.state,
		...(status.reason === undefined ? {} : { stateReason: status.reason }),
		budget: {
			granted: budget.granted,
			reserved: budget.reserved,
			settled: budget.settled,
			available: budget.available,
		},
	};
}

/** An owner's machines, newest first. */
export async function machinesOf(db: Executor, ownerId: string): Promise<OwnedMachine[]> {
	const rows = await db.execute<Row>(sql`
		select machines.id, machines.name, machine_definitions.kind, machine_definitions.settings,
			machines.wallet_address, machines.created_at
		from machines
		join machine_definitions on machine_definitions.id = machines.definition_id
		where machines.owner_id = ${ownerId}::uuid
		order by machines.created_at desc, machines.id desc`);

	const machines: OwnedMachine[] = [];
	for (const row of rows) machines.push(await summarise(db, row));
	return machines;
}

/** One machine, if it belongs to this owner. Nothing otherwise. */
export async function machineForOwner(
	db: Executor,
	ownerId: string,
	machineId: string,
): Promise<OwnedMachineDetail | undefined> {
	const rows = await db.execute<Row>(sql`
		select machines.id, machines.name, machine_definitions.kind, machine_definitions.settings,
			machines.wallet_address, machines.created_at
		from machines
		join machine_definitions on machine_definitions.id = machines.definition_id
		where machines.id = ${machineId}::uuid and machines.owner_id = ${ownerId}::uuid`);
	const row = rows[0];
	if (!row) return undefined;

	const events = await readMachineEvents(db, row.id);
	const limits = machineLimits(events);
	const summary = await summarise(db, row);
	return {
		...summary,
		settings: row.settings,
		limits: {
			maxPerTrade: limits.maxPerTrade,
			maxPerDay: limits.maxPerDay,
			approvedMints: limits.approvedMints,
		},
		actions: allowedActions(summary.state),
	};
}

/** What an owner asks a machine to do. Funding also carries the new grant. */
export type OwnerAction = {
	ownerId: string;
	machineId: string;
	action: MachineAction;
	/** Required when funding: the budget the machine may now spend, in total. */
	budgetGranted?: bigint;
};

export async function actOnMachine(
	db: Database,
	request: OwnerAction,
): Promise<Result<{ state: string }, MaschinaError>> {
	if (request.action === "fund" && (request.budgetGranted ?? 0n) <= 0n) {
		return err(new MaschinaError("invalid_input", "funding sets a budget above zero"));
	}

	return db.transaction(async (tx) => {
		// The machine is looked up as this owner's, so somebody else's id simply does not exist here.
		const rows = await tx.execute<{ id: string }>(sql`
			select id from machines
			where id = ${request.machineId}::uuid and owner_id = ${request.ownerId}::uuid
			for update`);
		if (!rows[0]) {
			return err(new MaschinaError("not_found", "no such machine"));
		}

		const events = await readMachineEvents(tx, request.machineId);
		const state = machineState(events).state;
		const moved = transition(state, request.action);
		if (!moved.ok) return moved;

		if (request.action === "fund") {
			const granted = request.budgetGranted ?? 0n;
			const written = await appendEvent(tx, {
				machineId: request.machineId,
				type: "machine.limits_changed",
				leaseEpoch: 0n,
				payload: {
					limit: "budgetGranted",
					from: machineBudget(events).granted.toString(),
					to: granted.toString(),
				},
			});
			if (!written.ok) return written;
			return ok({ state: moved.value.to });
		}

		const written = await appendEvent(tx, {
			machineId: request.machineId,
			type: eventFor(request.action),
			leaseEpoch: 0n,
			payload: payloadFor(request.action),
		});
		if (!written.ok) return written;
		return ok({ state: moved.value.to });
	});
}

const eventFor = (action: MachineAction) =>
	({
		start: "machine.started",
		pause: "machine.paused",
		resume: "machine.resumed",
		stop: "machine.stopped",
		fund: "machine.limits_changed",
	})[action];

const payloadFor = (action: MachineAction) =>
	action === "pause"
		? { reason: "owner" as const }
		: action === "stop"
			? { by: "owner" as const }
			: {};
