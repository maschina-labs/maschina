/**
 * What the signer needs to know to return a machine's funds, read from the record.
 *
 * The destination is looked up here rather than accepted from a caller. That is the whole safety story
 * of a withdrawal: the owner's wallet is joined through the machine, so the only address a machine's
 * funds can ever reach is the one recorded against its owner.
 */

import { machineState } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";

export type WithdrawingMachine = {
	wallet: string;
	ownerWallet: string;
	providerWalletId: string;
};

/** The machine's wallet, its owner's wallet, and the provider's id for the wallet it signs with. */
export async function machineForWithdrawal(
	db: Executor,
	machineId: string,
): Promise<WithdrawingMachine | undefined> {
	const rows = await db.execute<{
		wallet_address: string;
		owner_wallet: string;
		provider_wallet_id: string;
	}>(sql`
		select machines.wallet_address, machines.provider_wallet_id,
			owners.wallet_address as owner_wallet
		from machines
		join owners on owners.id = machines.owner_id
		where machines.id = ${machineId}::uuid`);

	const row = rows[0];
	if (!row) return undefined;
	return {
		wallet: row.wallet_address,
		ownerWallet: row.owner_wallet,
		providerWalletId: row.provider_wallet_id,
	};
}

/**
 * The signature already written down for this withdrawal, when there is one.
 *
 * Read from the record rather than a column, the same as a trade's, because the record is what decides
 * whether something was signed. A withdrawal with a signature is never signed again.
 */
export async function withdrawalSubmission(
	db: Executor,
	machineId: string,
	withdrawalId: string,
): Promise<{ signature: string; lastValidBlockHeight: bigint } | undefined> {
	for (const event of await readMachineEvents(db, machineId)) {
		if (event.type !== "withdrawal.submitted") continue;
		if (event.payload.withdrawalId !== withdrawalId) continue;
		return {
			signature: event.payload.signature,
			lastValidBlockHeight: BigInt(event.payload.lastValidBlockHeight),
		};
	}
	return undefined;
}

/**
 * What state a machine is in, or nothing when there is no such machine.
 *
 * Worked out from the record like every other fact about a machine. Used before a withdrawal, because a
 * machine that is still acting may have money committed to a trade in flight.
 */
export async function machineStateOf(db: Executor, machineId: string): Promise<string | undefined> {
	const rows = await db.execute<{ id: string }>(sql`
		select id from machines where id = ${machineId}::uuid`);
	if (!rows[0]) return undefined;
	return machineState(await readMachineEvents(db, machineId)).state;
}
