/**
 * Owners, identified by the Solana wallet address they sign in with.
 *
 * The address is the identity: names, emails and avatars come later, and none of them prove anything.
 * The database checks the shape of the address itself, so a malformed one can't be stored even by a
 * direct insert.
 */

import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Base58, 32 to 44 characters: the shape of every Solana address. */
export const SOLANA_ADDRESS = "^[1-9A-HJ-NP-Za-km-z]{32,44}$";

export const owners = pgTable(
	"owners",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		walletAddress: text("wallet_address").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	() => [check("owners_wallet_address_shape", sql.raw(`"wallet_address" ~ '${SOLANA_ADDRESS}'`))],
);
