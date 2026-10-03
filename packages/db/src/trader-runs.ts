/**
 * Keeping the AI trader's runs. The state goes in as JSON the engine can read back exactly: amounts are
 * whole numbers far past what JSON numbers hold, so they travel as tagged strings, and times as ISO.
 */

import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

export type TraderRunRow = {
	id: string;
	ownerId: string;
	status: string;
	state: unknown;
	updatedAt: Date;
};

/** Amounts and times out to JSON, tagged so they come back as what they were. */
export const freeze = (value: unknown): unknown =>
	JSON.parse(
		JSON.stringify(value, function (key, each) {
			const raw = (this as Record<string, unknown>)[key];
			if (typeof each === "bigint") return { $big: each.toString() };
			if (raw instanceof Date) return { $date: raw.toISOString() };
			return each;
		}),
	);

export const thaw = (value: unknown): unknown =>
	JSON.parse(JSON.stringify(value), (_key, each) => {
		if (each && typeof each === "object" && !Array.isArray(each)) {
			if (typeof each.$big === "string" && Object.keys(each).length === 1) return BigInt(each.$big);
			if (typeof each.$date === "string" && Object.keys(each).length === 1)
				return new Date(each.$date);
		}
		return each;
	});

type Row = {
	id: string;
	owner_id: string;
	status: string;
	state: unknown;
	updated_at: Date | string;
};
const asRun = (row: Row): TraderRunRow => ({
	id: row.id,
	ownerId: row.owner_id,
	status: row.status,
	state: thaw(row.state),
	updatedAt: new Date(row.updated_at),
});

export async function saveTraderRun(
	db: Executor,
	run: { id: string; ownerId: string; status: string; state: unknown },
): Promise<void> {
	const state = JSON.stringify(freeze(run.state));
	await db.execute(sql`
		insert into trader_runs (id, owner_id, mode, status, state)
		values (${run.id}::uuid, ${run.ownerId}::uuid, 'paper', ${run.status}, ${state}::jsonb)
		on conflict (id) do update set status = excluded.status, state = excluded.state, updated_at = now()`);
}

/** The owner's newest run, whatever its state. */
export async function latestTraderRun(
	db: Executor,
	ownerId: string,
): Promise<TraderRunRow | undefined> {
	const rows = await db.execute<Row>(sql`
		select id, owner_id, status, state, updated_at from trader_runs
		where owner_id = ${ownerId}::uuid order by created_at desc limit 1`);
	return rows[0] ? asRun(rows[0]) : undefined;
}

/** Every run still running, for the engine to pick up when it starts. */
export async function runningTraderRuns(db: Executor): Promise<TraderRunRow[]> {
	const rows = await db.execute<Row>(sql`
		select id, owner_id, status, state, updated_at from trader_runs where status = 'running'`);
	return rows.map(asRun);
}
