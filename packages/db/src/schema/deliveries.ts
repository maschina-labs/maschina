/**
 * Which alerts have been told to their owner, and where.
 *
 * An alert is an event in the record worth telling somebody about: a trade, a failure, a machine that
 * paused itself. The record says what happened; this says who has heard. One row per event per channel,
 * written once the message is out, so a restart never tells anybody the same thing twice and a message
 * that failed to send is tried again.
 */

import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const deliveries = pgTable(
	"deliveries",
	{
		// Not a foreign key: a key referencing the record would change how the database refuses to
		// truncate it, and the record is never deleted from, so every id here stays valid.
		eventId: uuid("event_id").notNull(),
		/** Where it was told. Telegram first; the app's own notifications later. */
		channel: text("channel").notNull(),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.eventId, table.channel] }),
		check("deliveries_channel_known", sql.raw(`"channel" in ('telegram')`)),
	],
);
