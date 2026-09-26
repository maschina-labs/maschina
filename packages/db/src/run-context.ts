/**
 * What a node is told about a run it holds.
 *
 * A node never touches the database, and may be running on someone else's computer. So it is told only
 * what it needs to run the machine, and only while it holds the run: the lease is checked in the same
 * statement that reads the machine, so a node whose lease lapsed learns nothing.
 */

import {
	budgetMintOf,
	KNOWN_KINDS,
	machineBudget,
	machineState,
	paperHoldings,
} from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";

export type RunContext = {
	runId: string;
	machineId: string;
	wallet: string;
	kind: string;
	/** True when this machine only pretends to trade, so its wallet is imaginary. */
	paper: boolean;
	/** The level that woke this run, for a machine waiting on more than one. */
	wokeOn?: string;
	/** What a machine on paper holds, by mint, from its own record. */
	holdings?: Record<string, bigint>;
	settings: unknown;
	dueAt: Date;
	state: string;
	/** Only a running machine may act. Anything else is recorded as a skip. */
	canAct: boolean;
	availableBudget: bigint;
	totals: { spent: bigint; buys: number };
};

type ContextRow = {
	paper: boolean;
	woke_on: string | null;
	machine_id: string;
	wallet_address: string;
	kind: string;
	settings: unknown;
	due_at: string | Date;
};

export async function runContext(
	db: Executor,
	lease: { runId: string; nodeId: string; leaseEpoch: bigint; now: Date },
): Promise<RunContext | undefined> {
	const rows = await db.execute<ContextRow>(sql`
		select runs.machine_id, machines.wallet_address, machines.paper, machine_definitions.kind,
			machine_definitions.settings, runs.due_at, runs.woke_on
		from runs
		join machines on machines.id = runs.machine_id
		join machine_definitions on machine_definitions.id = machines.definition_id
		where runs.id = ${lease.runId}::uuid
			and runs.state = 'leased'
			and runs.leased_by = ${lease.nodeId}::uuid
			and runs.lease_epoch = ${lease.leaseEpoch.toString()}::bigint
			and runs.lease_expires_at > ${lease.now.toISOString()}::timestamptz`);
	const row = rows[0];
	if (!row) return undefined;

	const events = await readMachineEvents(db, row.machine_id);
	const state = machineState(events).state;
	// The node is told the same number the ledger will enforce, counted in the machine's own currency.
	const budgetMint = budgetMintOf(KNOWN_KINDS, row.kind, row.settings);
	const budget = machineBudget(events, budgetMint === undefined ? {} : { budgetMint });
	let spent = 0n;
	let buys = 0;
	for (const event of events) {
		if (event.type !== "trade.completed") continue;
		spent += BigInt(event.payload.inputAmount);
		buys++;
	}

	return {
		runId: lease.runId,
		machineId: row.machine_id,
		wallet: row.wallet_address,
		kind: row.kind,
		paper: row.paper,
		// Left out rather than set to nothing: a scheduled run was woken by no level at all.
		...(row.woke_on === null || row.woke_on === undefined ? {} : { wokeOn: row.woke_on }),
		// Only a machine on paper needs telling what it holds. A real one reads its own wallet.
		...(row.paper ? { holdings: Object.fromEntries(paperHoldings(events)) } : {}),
		settings: row.settings,
		dueAt: row.due_at instanceof Date ? row.due_at : new Date(row.due_at),
		state,
		canAct: state === "running",
		availableBudget: budget.available,
		totals: { spent, buys },
	};
}
