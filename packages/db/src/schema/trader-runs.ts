/**
 * The AI trader's runs: one row per run, its whole state kept as it goes.
 *
 * A run's state is the engine's own: the book, the limits, what it is thinking and why. It is written
 * after every tick, so a restart picks up exactly where it was. Paper only for now; live runs will keep
 * their fills in the record like every machine, and this row will only point at them.
 */

import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { owners } from "./owners.ts";

export const traderRuns = pgTable(
	"trader_runs",
	{
		id: uuid("id").primaryKey(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => owners.id),
		mode: text("mode").notNull(),
		status: text("status").notNull(),
		state: jsonb("state").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("trader_runs_owner").on(table.ownerId, table.createdAt),
		check("trader_runs_mode_known", sql.raw(`"mode" in ('paper')`)),
		check("trader_runs_status_known", sql.raw(`"status" in ('running', 'paused', 'stopped')`)),
	],
);
