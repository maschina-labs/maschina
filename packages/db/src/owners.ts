/**
 * Making an owner.
 *
 * An owner is a wallet address that signed in. Ids are made here rather than by the database, because
 * every id in the record is a v7 id and the database's own default was not one (#551).
 *
 * Signing in twice is not an error: the same wallet is the same owner, so the existing row comes back.
 */

import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

export type Owner = {
	id: string;
	walletAddress: string;
	/** False when this wallet had already signed in before. */
	created: boolean;
};

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function createOwner(
	db: Executor,
	walletAddress: string,
): Promise<Result<Owner, MaschinaError>> {
	if (!SOLANA_ADDRESS.test(walletAddress)) {
		return err(new MaschinaError("invalid_input", "that is not a Solana address"));
	}

	const id = newId<"owner">();
	const rows = await db.execute<{ id: string; wallet_address: string }>(sql`
		insert into owners (id, wallet_address) values (${id}::uuid, ${walletAddress})
		on conflict (wallet_address) do nothing
		returning id, wallet_address`);

	const made = rows[0];
	if (made) return ok({ id: made.id, walletAddress: made.wallet_address, created: true });

	const existing = await db.execute<{ id: string; wallet_address: string }>(
		sql`select id, wallet_address from owners where wallet_address = ${walletAddress}`,
	);
	const row = existing[0];
	if (!row) {
		return err(new MaschinaError("internal", "the owner was neither created nor found"));
	}
	return ok({ id: row.id, walletAddress: row.wallet_address, created: false });
}
