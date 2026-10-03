/**
 * Keeping an owner's secrets: sealed text in, sealed text out.
 *
 * Nothing here can open a secret. Sealing and opening happen in the service that holds the key, so the
 * database layer only ever handles text that is useless on its own.
 */

import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";

export type SecretKind = "anthropic";

export type StoredSecret = { sealed: string; hint: string; setAt: Date };

/** Keeps a secret, replacing whatever of that kind the owner gave before. */
export async function setOwnerSecret(
	db: Executor,
	secret: { ownerId: string; kind: SecretKind; sealed: string; hint: string },
): Promise<void> {
	await db.execute(sql`
		insert into owner_secrets (owner_id, kind, sealed, hint)
		values (${secret.ownerId}::uuid, ${secret.kind}, ${secret.sealed}, ${secret.hint})
		on conflict (owner_id, kind) do update
			set sealed = excluded.sealed, hint = excluded.hint, set_at = now()`);
}

export async function readOwnerSecret(
	db: Executor,
	ownerId: string,
	kind: SecretKind,
): Promise<StoredSecret | undefined> {
	const rows = await db.execute<{ sealed: string; hint: string; set_at: Date | string }>(sql`
		select sealed, hint, set_at from owner_secrets
		where owner_id = ${ownerId}::uuid and kind = ${kind}`);
	const row = rows[0];
	return row ? { sealed: row.sealed, hint: row.hint, setAt: new Date(row.set_at) } : undefined;
}

/** Forgets a secret. True when there was one to forget. */
export async function clearOwnerSecret(
	db: Executor,
	ownerId: string,
	kind: SecretKind,
): Promise<boolean> {
	const rows = await db.execute<{ kind: string }>(sql`
		delete from owner_secrets where owner_id = ${ownerId}::uuid and kind = ${kind} returning kind`);
	return rows.length > 0;
}
