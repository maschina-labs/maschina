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
import { readMachineEvents } from "./read-events.ts";

export type WatchingMachine = {
	machineId: string;
	kind: string;
	settings: unknown;
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
		const state = machineState(await readMachineEvents(db, row.id)).state;
		if (state !== "running") continue;
		watching.push({ machineId: row.id, kind: row.kind, settings: row.settings });
	}
	return watching;
}
