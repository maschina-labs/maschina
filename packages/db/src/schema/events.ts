/**
 * The permanent record: every event a machine produces, written once.
 *
 * Nothing here is ever updated or deleted. Machine state, budgets and every other view are worked out
 * from these rows, so a row that changed later would rewrite history. The database enforces that
 * itself, in the migration, for every role including the owner.
 */

import { EVENT_TYPES } from "@maschina/contracts";
import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const events = pgTable(
	"events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** The machine the event belongs to. The machines table arrives later, with the link. */
		machineId: uuid("machine_id").notNull(),
		/** The event type, whose payload shape is defined in `@maschina/contracts`. */
		type: text("type").notNull(),
		payload: jsonb("payload").notNull().default({}),
		/**
		 * Whether this happened with real money or on paper.
		 *
		 * Never supplied by the caller. A trigger reads it from the machine's own `paper` flag in the
		 * same statement that writes the event, so no code path can get it wrong and none has to
		 * remember to try. The same trigger refuses a machine on paper writing an event that only
		 * exists because something was signed, and a live machine writing a simulated trade.
		 */
		mode: text("mode").notNull(),
		/** The lease epoch of the node that wrote it, so a stale node's writes can be refused. */
		leaseEpoch: bigint("lease_epoch", { mode: "bigint" }).notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("events_machine_time").on(table.machineId, table.occurredAt),
		index("events_machine_mode").on(table.machineId, table.mode),
		check("events_mode_known", sql.raw(`"mode" in ('paper', 'live')`)),
		// Only types defined in the contracts may be written. Adding one means a migration, on purpose:
		// the record is forever, so a typo'd type would live in it forever too.
		check(
			"events_type_known",
			sql.raw(`"type" in (${EVENT_TYPES.map((type) => `'${type}'`).join(", ")})`),
		),
	],
);
