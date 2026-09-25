/**
 * Signing in: the two things that have to be remembered.
 *
 * A nonce is handed out before a wallet signs anything, and may be answered exactly once. Single use is
 * the whole point: a message captured on its way past is worthless the moment its nonce is spent, so
 * spending it is a conditional update in the database rather than a check followed by a write.
 *
 * A session is a long random token the browser holds. Only its hash is stored, so a copy of this table
 * cannot be used to sign in as anybody: the same reason a password is never stored as itself.
 */

import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { owners, SOLANA_ADDRESS, V7_ID } from "./owners.ts";

export const signInNonces = pgTable(
	"sign_in_nonces",
	{
		/** The nonce itself, which is what makes it unrepeatable. */
		nonce: text("nonce").primaryKey(),
		/** The wallet that asked, so a nonce cannot be answered by a different one. */
		walletAddress: text("wallet_address").notNull(),
		issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		/** Set the moment it is answered. A second answer finds it already set and is refused. */
		usedAt: timestamp("used_at", { withTimezone: true }),
	},
	(table) => [
		index("sign_in_nonces_expiry").on(table.expiresAt),
		check("sign_in_nonces_wallet_shape", sql.raw(`"wallet_address" ~ '${SOLANA_ADDRESS}'`)),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").primaryKey(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => owners.id),
		/** Only the hash. The token itself exists in the owner's browser and nowhere else. */
		tokenHash: text("token_hash").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		/** Set when the session is ended, by signing out or by an owner ending it from elsewhere. */
		endedAt: timestamp("ended_at", { withTimezone: true }),
	},
	(table) => [
		index("sessions_owner").on(table.ownerId),
		index("sessions_expiry").on(table.expiresAt),
		check("sessions_id_is_v7", sql.raw(`"id"::text ~ '${V7_ID}'`)),
	],
);
