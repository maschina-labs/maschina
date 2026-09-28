/**
 * The machines waiting on a price.
 *
 * The watcher follows only prices some machine is actually waiting for, and only for machines that
 * could act on a crossing. A paused or stopped machine's level is not watched: queueing a run it would
 * only skip fills the record with noise and spends quota on prices nobody is using.
 */

import { machineState, PRICE_WATCHING_KINDS } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { readMachineEvents, type StoredEvent } from "./read-events.ts";
import { type AppendResult, appendOwnerEvent } from "./record.ts";

export type WatchingMachine = {
	machineId: string;
	kind: string;
	settings: unknown;
	/** The record already read to see it is running, for a kind whose levels follow what it has done. */
	events: StoredEvent[];
};

type Row = { id: string; kind: string; settings: unknown };

export async function machinesWatchingPrices(db: Executor): Promise<WatchingMachine[]> {
	const rows = await db.execute<Row>(sql`
		select machines.id, machine_definitions.kind, machine_definitions.settings
		from machines
		join machine_definitions on machine_definitions.id = machines.definition_id
		where machine_definitions.kind in (${sql.join(
			PRICE_WATCHING_KINDS.map((kind) => sql`${kind}`),
			sql`, `,
		)})`);

	const watching: WatchingMachine[] = [];
	for (const row of rows) {
		// Whether a machine is running is worked out from the record, never stored, so it is read here
		// rather than joined.
		const events = await readMachineEvents(db, row.id);
		if (machineState(events).state !== "running") continue;
		watching.push({ machineId: row.id, kind: row.kind, settings: row.settings, events });
	}
	return watching;
}

/**
 * Records the price a following machine's band now sits around.
 *
 * Written by the orchestrator, which is not a node running the machine, so it is not fenced by a lease:
 * a band move is never stale in the way a cut-off node's write is. It goes in the way an owner's action
 * does, at the newest epoch, so it never lowers the fence for anyone else.
 */
export function recordRecentre(
	db: Executor,
	move: { machineId: string; price: bigint; because: "started" | "followed" | "after_floor" },
): Promise<AppendResult> {
	return appendOwnerEvent(db, {
		machineId: move.machineId,
		type: "machine.recentred",
		payload: { price: move.price.toString(), because: move.because },
	});
}
