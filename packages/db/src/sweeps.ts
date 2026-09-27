/**
 * What the signer needs to know to bank a machine's profit, read from the record.
 *
 * The vault is looked up here rather than accepted from a caller, the same as a withdrawal's owner: the
 * only place a sweep can go is the vault recorded against the machine when it was made.
 */

import { budgetMintOf, KNOWN_KINDS, type MachineFloat, machineFloat } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";

export type SweepingMachine = {
	wallet: string;
	/** Absent for a machine made before vaults. */
	vault?: string;
	providerWalletId: string;
	/** Absent when the machine's kind counts its budget in nothing. */
	budgetMint?: string;
	paper: boolean;
};

async function definitionOf(db: Executor, machineId: string) {
	const rows = await db.execute<{
		wallet_address: string;
		vault_address: string | null;
		provider_wallet_id: string;
		paper: boolean;
		kind: string;
		settings: unknown;
	}>(sql`
		select machines.wallet_address, machines.vault_address, machines.provider_wallet_id,
			machines.paper, machine_definitions.kind, machine_definitions.settings
		from machines
		join machine_definitions on machine_definitions.id = machines.definition_id
		where machines.id = ${machineId}::uuid`);
	return rows[0];
}

/** The machine's trading account, its vault, and the currency its float is counted in. */
export async function machineForSweep(
	db: Executor,
	machineId: string,
): Promise<SweepingMachine | undefined> {
	const row = await definitionOf(db, machineId);
	if (!row) return undefined;
	const budgetMint = budgetMintOf(KNOWN_KINDS, row.kind, row.settings);
	return {
		wallet: row.wallet_address,
		...(row.vault_address === null ? {} : { vault: row.vault_address }),
		providerWalletId: row.provider_wallet_id,
		...(budgetMint === undefined ? {} : { budgetMint }),
		paper: row.paper,
	};
}

/**
 * The machine's float, around what the chain says its trading account holds.
 *
 * The holding comes from the caller because only the chain knows it. Everything else, the line, the
 * open position at cost, whether a trade is in flight, comes from the record.
 */
export async function floatFor(
	db: Executor,
	machineId: string,
	holding: bigint,
): Promise<Pick<MachineFloat, "target" | "value" | "sweep">> {
	const row = await definitionOf(db, machineId);
	const budgetMint = row ? budgetMintOf(KNOWN_KINDS, row.kind, row.settings) : undefined;
	const float = machineFloat(await readMachineEvents(db, machineId), { budgetMint, holding });
	return { target: float.target, value: float.value, sweep: float.sweep };
}

/**
 * The signature already written down for this sweep, when there is one. Read from the record, like a
 * trade's and a withdrawal's, because the record decides whether something was signed.
 */
export async function sweepSubmission(
	db: Executor,
	machineId: string,
	sweepId: string,
): Promise<{ signature: string; lastValidBlockHeight: bigint } | undefined> {
	for (const event of await readMachineEvents(db, machineId)) {
		if (event.type !== "sweep.submitted") continue;
		if (event.payload.sweepId !== sweepId) continue;
		return {
			signature: event.payload.signature,
			lastValidBlockHeight: BigInt(event.payload.lastValidBlockHeight),
		};
	}
	return undefined;
}

/**
 * What was decided when this sweep was asked for. A sweep that was signed is finished from this, never
 * decided again, because by the time it is asked about the account may already be back on its line.
 */
export async function sweepRequested(
	db: Executor,
	machineId: string,
	sweepId: string,
): Promise<{ to: string; mint: string; amount: bigint } | undefined> {
	for (const event of await readMachineEvents(db, machineId)) {
		if (event.type !== "sweep.requested") continue;
		if (event.payload.sweepId !== sweepId) continue;
		return { to: event.payload.to, mint: event.payload.mint, amount: BigInt(event.payload.amount) };
	}
	return undefined;
}
