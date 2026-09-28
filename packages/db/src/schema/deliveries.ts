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
import { events } from "./events.ts";

export const deliveries = pgTable(
	"deliveries",
	{
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id),
		/** Where it was told. Telegram first; the app's own notifications later. */
		channel: text("channel").notNull(),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.eventId, table.channel] }),
		check("deliveries_channel_known", sql.raw(`"channel" in ('telegram')`)),
	],
);
