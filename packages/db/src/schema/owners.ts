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

/**
 * A v7 id, the only kind the record accepts.
 *
 * This column used to hand out random v4 ids, which meant an owner made the ordinary way could never
 * have their machine's creation written down. Ids come from the code now, and the database refuses
 * anything else so it cannot happen again.
 */
export const V7_ID = "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export const owners = pgTable(
	"owners",
	{
		id: uuid("id").primaryKey(),
		walletAddress: text("wallet_address").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	() => [
		check("owners_wallet_address_shape", sql.raw(`"wallet_address" ~ '${SOLANA_ADDRESS}'`)),
		check("owners_id_is_v7", sql.raw(`"id"::text ~ '${V7_ID}'`)),
	],
);
