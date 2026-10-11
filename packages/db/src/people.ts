/**
 * Owners who are people, not wallets.
 *
 * Better Auth keeps who a person is. This is the other half: the owner a person's machines belong to. An owner
 * made here has no wallet until the person links one, and nothing that moves real money works until then, so
 * the wallet is the one thing a person has to prove before money can leave.
 */

import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type PersonOwner = {
	id: string;
	walletAddress: string | null;
	/** False when this person already had an owner. */
	created: boolean;
};

/** The owner for a person, made the first time and the same one every time after. */
export async function createOwnerForUser(
	db: Executor,
	userId: string,
): Promise<Result<PersonOwner, MaschinaError>> {
	const id = newId<"owner">();
	const made = await db.execute<{ id: string }>(sql`
		insert into owners (id, user_id) values (${id}::uuid, ${userId})
		on conflict (user_id) do nothing
		returning id`);
	if (made[0]) return ok({ id: made[0].id, walletAddress: null, created: true });

	const existing = await db.execute<{ id: string; wallet_address: string | null }>(
		sql`select id, wallet_address from owners where user_id = ${userId}`,
	);
	const row = existing[0];
	if (!row) return err(new MaschinaError("internal", "the owner was neither created nor found"));
	return ok({ id: row.id, walletAddress: row.wallet_address, created: false });
}

export type PersonOwnerRef = { ownerId: string; walletAddress: string | null };

/** The owner a signed in person has, if they have one yet. */
export async function ownerOfUser(
	db: Executor,
	userId: string,
): Promise<PersonOwnerRef | undefined> {
	const rows = await db.execute<{ id: string; wallet_address: string | null }>(
		sql`select id, wallet_address from owners where user_id = ${userId}`,
	);
	const row = rows[0];
	return row ? { ownerId: row.id, walletAddress: row.wallet_address } : undefined;
}

/**
 * Gives an owner a wallet. A wallet belongs to one owner, so one that already belongs to another is refused,
 * and an owner that already has a different wallet keeps it: changing where money goes is not done here.
 * Linking the wallet the owner already has is fine.
 */
export async function linkWallet(
	db: Executor,
	ownerId: string,
	walletAddress: string,
): Promise<Result<{ walletAddress: string }, MaschinaError>> {
	if (!SOLANA_ADDRESS.test(walletAddress)) {
		return err(new MaschinaError("invalid_input", "that is not a Solana address"));
	}
	const owner = await db.execute<{ wallet_address: string | null }>(
		sql`select wallet_address from owners where id = ${ownerId}::uuid`,
	);
	const current = owner[0];
	if (!current) return err(new MaschinaError("not_found", "there is no such owner"));
	if (current.wallet_address === walletAddress) return ok({ walletAddress });
	if (current.wallet_address) {
		return err(
			new MaschinaError(
				"conflict",
				"this owner already has a wallet, which cannot be changed here",
			),
		);
	}
	const set = await db.execute<{ id: string }>(sql`
		update owners set wallet_address = ${walletAddress}
		where id = ${ownerId}::uuid and wallet_address is null
			and not exists (select 1 from owners other where other.wallet_address = ${walletAddress})
		returning id`);
	if (!set[0]) {
		return err(new MaschinaError("conflict", "that wallet already belongs to another owner"));
	}
	return ok({ walletAddress });
}
