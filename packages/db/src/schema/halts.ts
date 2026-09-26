/**
 * The kill switch: one row, engaged or released.
 *
 * Everything else about a machine lives in the record, which is per machine. A halt is not about one
 * machine, and it has to work when a machine, a node or the orchestrator is the thing misbehaving. So it
 * is a row of its own that the signer reads before it will sign anything, because the signer is the only
 * thing that can move money. A node that keeps proposing after a halt gets refused, which is the whole
 * point: stopping has to work without the cooperation of the thing being stopped.
 *
 * Rows are never deleted or overwritten. Releasing a halt fills in `released_at`, so the history of every
 * halt and how long it lasted stays readable.
 */

import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const halts = pgTable(
	"halts",
	{
		id: uuid("id").primaryKey(),
		/** Why it was engaged, in the words of whoever engaged it. Read by anybody wondering. */
		reason: text("reason").notNull(),
		/** Who engaged it: an operator's name, or the name of the check that tripped. */
		engagedBy: text("engaged_by").notNull(),
		engagedAt: timestamp("engaged_at", { withTimezone: true }).notNull().defaultNow(),
		/** Empty while the halt is in force. */
		releasedAt: timestamp("released_at", { withTimezone: true }),
		releasedBy: text("released_by"),
	},
	(table) => [
		// Reading "is anything halted right now" is the hot path: the signer asks on every proposal.
		index("halts_in_force").on(table.releasedAt),
		check("halts_reason_given", sql.raw(`length("reason") between 1 and 500`)),
		// Released is all or nothing: a time and who did it, or neither.
		check(
			"halts_release_complete",
			sql.raw(
				`("released_at" is null and "released_by" is null) or ("released_at" is not null and "released_by" is not null)`,
			),
		),
	],
);
