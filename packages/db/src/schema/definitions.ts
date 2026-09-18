/**
 * Machine definitions: a machine's recipe, identified by what it says.
 *
 * A definition is an artifact, not a row that gets edited (CARRYOVER, section 4). Its id is the hash of
 * its content, so the same recipe always has the same id, and changing a recipe makes a new version
 * instead of altering the old one. A running machine is pinned to one version, which is how its
 * behaviour stays explainable long after its owner has moved on.
 *
 * The database refuses updates and deletes, as it does for the record, so a definition someone is
 * pinned to can't change under them.
 */

import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const machineDefinitions = pgTable(
	"machine_definitions",
	{
		/** The content id: the SHA-256 of the canonical recipe, 64 hex characters. */
		id: text("id").primaryKey(),
		/** What sort of job the machine does. Kinds are data, not code, and the runtime never names one. */
		kind: text("kind").notNull(),
		/** The settings for that kind: amounts, tokens, schedule. */
		settings: jsonb("settings").notNull(),
		/** The limits the owner set: the most per trade, per day, approved tokens and recipients. */
		rules: jsonb("rules").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	() => [
		check("machine_definitions_id_shape", sql.raw(`"id" ~ '^[0-9a-f]{64}$'`)),
		check("machine_definitions_kind_shape", sql.raw(`"kind" ~ '^[a-z][a-z0-9_]{2,39}$'`)),
	],
);
