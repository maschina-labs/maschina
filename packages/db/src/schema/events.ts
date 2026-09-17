/**
 * The permanent record: every event a machine produces, written once.
 *
 * Nothing here is ever updated or deleted. Machine state, budgets and every other view are worked out
 * from these rows, so a row that changed later would rewrite history. The database enforces that
 * itself, in the migration, for every role including the owner.
 */

import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const events = pgTable(
	"events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** The machine the event belongs to. The machines table arrives later, with the link. */
		machineId: uuid("machine_id").notNull(),
		/** The event type, whose payload shape is defined in `@maschina/contracts`. */
		type: text("type").notNull(),
		payload: jsonb("payload").notNull().default({}),
		/** The lease epoch of the node that wrote it, so a stale node's writes can be refused. */
		leaseEpoch: bigint("lease_epoch", { mode: "bigint" }).notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("events_machine_time").on(table.machineId, table.occurredAt)],
);
