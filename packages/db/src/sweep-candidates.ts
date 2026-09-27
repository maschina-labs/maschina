/**
 * Which machines could have profit to bank, for the orchestrator to ask about.
 *
 * Not a decision about whether anything is due: only the signer can say that, because only it reads the
 * chain. This is the list of machines it is worth asking about: made with a vault, spending real money,
 * running or paused, and not in the middle of a run.
 */

import { machineState } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";

export type SweepCandidate = { machineId: string; openSweepId?: string };

/** States a machine may be banked in. A stopped machine's owner is taking their money, not earning it. */
const SWEEPABLE = new Set(["running", "paused"]);

export async function sweepCandidates(db: Executor): Promise<SweepCandidate[]> {
	const rows = await db.execute<{ id: string }>(sql`
		select machines.id
		from machines
		where machines.vault_address is not null
			and machines.paper = false
			and not exists (
				select 1 from runs where runs.machine_id = machines.id and runs.state = 'leased'
			)`);

	const candidates: SweepCandidate[] = [];
	for (const row of rows) {
		const events = await readMachineEvents(db, row.id);
		if (!SWEEPABLE.has(machineState(events).state)) continue;
		const open = openSweepIn(events);
		candidates.push(
			open === undefined ? { machineId: row.id } : { machineId: row.id, openSweepId: open },
		);
	}
	return candidates;
}

/** A sweep that was sent and has not been written down as finished, either way. */
function openSweepIn(events: Awaited<ReturnType<typeof readMachineEvents>>): string | undefined {
	const sent = new Set<string>();
	for (const event of events) {
		if (event.type === "sweep.submitted") sent.add(event.payload.sweepId);
		if (event.type === "sweep.completed" || event.type === "sweep.failed") {
			sent.delete(event.payload.sweepId);
		}
	}
	return [...sent][0];
}
