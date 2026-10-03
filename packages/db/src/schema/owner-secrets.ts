/**
 * Secrets an owner has given us, sealed. Their own AI key first.
 *
 * Only the sealed text is stored. The key that opens it lives in the server's environment, so this table
 * on its own gives nobody anything. One secret of each kind per owner: giving a new one replaces the old.
 * The hint is the last four characters, so an owner can tell which key is in without it being shown.
 */

import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { owners } from "./owners.ts";

export const ownerSecrets = pgTable(
	"owner_secrets",
	{
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => owners.id),
		kind: text("kind").notNull(),
		sealed: text("sealed").notNull(),
		hint: text("hint").notNull(),
		setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.kind] }),
		check("owner_secrets_kind_known", sql.raw(`"kind" in ('anthropic')`)),
		check("owner_secrets_sealed_shape", sql.raw(`"sealed" ~ '^v1\\.'`)),
	],
);
