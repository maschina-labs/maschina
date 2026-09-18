/**
 * Machines: one owner, exactly one wallet, one pinned recipe.
 *
 * A machine's wallet is its own. Two machines sharing one would mean two sets of rules over the same
 * money, and a limit that holds for one could be spent through by the other, so the database refuses
 * it. The pinned definition is what the machine is running now; changing a recipe means pinning a new
 * version, never editing the old one.
 *
 * The machine's state (draft, running, paused, stopped) is not stored here. It is worked out from the
 * record, so the record stays the only place history lives.
 */

import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { machineDefinitions } from "./definitions.ts";
import { owners, SOLANA_ADDRESS } from "./owners.ts";

export const machines = pgTable(
	"machines",
	{
		id: uuid("id").primaryKey(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => owners.id),
		/** The machine's own Solana wallet, held by the wallet provider. */
		walletAddress: text("wallet_address").notNull().unique(),
		/** The provider's id for that wallet, so the signer can ask for a signature. */
		providerWalletId: text("provider_wallet_id").notNull(),
		/** Which provider holds it, so a wallet is never asked of the wrong one. */
		provider: text("provider").notNull(),
		definitionId: text("definition_id")
			.notNull()
			.references(() => machineDefinitions.id),
		name: text("name").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("machines_owner").on(table.ownerId),
		check("machines_wallet_address_shape", sql.raw(`"wallet_address" ~ '${SOLANA_ADDRESS}'`)),
		check("machines_provider_known", sql.raw(`"provider" in ('turnkey', 'crossmint')`)),
		check("machines_name_length", sql.raw(`length("name") between 1 and 60`)),
	],
);
