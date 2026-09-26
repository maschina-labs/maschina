/**
 * The run queue: one row per scheduled occurrence, waiting to be done.
 *
 * The occurrence key is what stops the same buy happening twice. It is unique per machine, so two
 * schedulers waking at the same instant, or a retry after a timeout, produce one row and not two. The
 * database decides that, not the code, because "check then insert" always has a gap between the check
 * and the insert.
 *
 * A run is leased to exactly one node at a time. The lease has an expiry and a rising epoch number: a
 * node that was cut off and comes back holds an old epoch, and the record refuses its writes.
 */

import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { machines } from "./machines.ts";

export const RUN_STATES = ["queued", "leased", "done"] as const;

export const runs = pgTable(
	"runs",
	{
		id: uuid("id").primaryKey(),
		machineId: uuid("machine_id")
			.notNull()
			.references(() => machines.id),
		/** Identifies the occurrence: the same scheduled moment always gives the same key. */
		occurrenceKey: text("occurrence_key").notNull(),
		/** When the run was due, which is not when it was queued or started. */
		dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
		/**
		 * The level that woke the machine, named by its kind. Empty for a run that came from a schedule.
		 *
		 * A machine waiting on one level can work out what happened; a machine waiting on two cannot, and
		 * guessing from the price at the time it finally runs is guessing.
		 */
		wokeOn: text("woke_on"),
		state: text("state").notNull().default("queued"),
		/** The node holding the lease, while one does. */
		leasedBy: uuid("leased_by"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		/** Rises every time the run is leased, so a stale node's writes can be refused. */
		// The default is written as SQL: the migration generator cannot serialise a bigint literal.
		leaseEpoch: bigint("lease_epoch", { mode: "bigint" }).notNull().default(sql`0`),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique("runs_occurrence").on(table.machineId, table.occurrenceKey),
		// Finding work: the queue is read by "what is due now and not taken".
		index("runs_due").on(table.state, table.dueAt),
		check("runs_state_known", sql.raw(`"state" in ('queued', 'leased', 'done')`)),
		// A lease is all or nothing: a holder, an expiry, and an epoch above zero.
		check(
			"runs_lease_complete",
			sql.raw(
				`("leased_by" is null and "lease_expires_at" is null) or ("leased_by" is not null and "lease_expires_at" is not null and "lease_epoch" > 0)`,
			),
		),
	],
);
