/**
 * Writing a machine into the record.
 *
 * A machine exists once its owner, its pinned definition, its wallet and its limits are all in the
 * database together. Half a machine is worse than none: a wallet nobody owns, or a row with no limits
 * that the rules would read as "no limit". So this is one transaction, and either all of it happens or
 * none of it does.
 *
 * The wallet itself is made elsewhere, by whoever holds the provider's admin key. By the time a machine
 * is written, its wallet already exists and its policy has been read back.
 */

import { err, MaschinaError, newId, ok, type Result } from "@maschina/core";
import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { saveDefinition } from "./definitions.ts";
import { createOwner } from "./owners.ts";
import { appendEvent } from "./record.ts";

export type MachineToWrite = {
	/** The owner's own wallet: the only address this machine's funds can ever reach. */
	ownerWallet: string;
	name: string;
	/** True when the machine only ever pretends to trade. Decided here and never changed after. */
	paper?: boolean;
	kind: string;
	settings: Record<string, unknown>;
	rules: Record<string, unknown>;
	wallet: { address: string; providerWalletId: string; provider: string };
	limits: {
		/** What the owner is putting behind this machine. A machine without one cannot act. */
		budgetGranted: bigint;
		maxPerTrade?: bigint;
		maxPerDay?: bigint;
		approvedMints: readonly string[];
	};
};

export type WrittenMachine = {
	machineId: string;
	ownerId: string;
	walletAddress: string;
	definitionId: string;
};

export async function writeMachine(
	db: Database,
	machine: MachineToWrite,
): Promise<Result<WrittenMachine, MaschinaError>> {
	if (machine.name.trim().length === 0) {
		return err(new MaschinaError("invalid_input", "a machine needs a name"));
	}
	if (machine.limits.budgetGranted <= 0n) {
		return err(new MaschinaError("invalid_input", "a machine needs a budget to be able to act"));
	}
	if (machine.limits.approvedMints.length === 0) {
		return err(new MaschinaError("invalid_input", "a machine needs at least one approved token"));
	}

	try {
		return await writeInOneGo(db, machine);
	} catch (cause) {
		// A failed statement takes the whole transaction with it, and the error surfaces here rather
		// than where it happened. A wallet already in use is the one we expect.
		const message = cause instanceof Error ? cause.message : String(cause);
		if (/machines_wallet_address_unique|duplicate key/i.test(message)) {
			return err(
				new MaschinaError("conflict", "that wallet already belongs to a machine", { cause }),
			);
		}
		return err(new MaschinaError("internal", "the machine could not be written", { cause }));
	}
}

async function writeInOneGo(
	db: Database,
	machine: MachineToWrite,
): Promise<Result<WrittenMachine, MaschinaError>> {
	return db.transaction(async (tx) => {
		const owner = await createOwner(tx, machine.ownerWallet);
		if (!owner.ok) return owner;

		const definition = await saveDefinition(tx, {
			kind: machine.kind,
			settings: machine.settings,
			rules: machine.rules,
		});
		if (!definition.ok) return definition;

		const machineId = newId<"machine">();
		await tx.execute(sql`
				insert into machines
					(id, owner_id, wallet_address, provider_wallet_id, provider, definition_id, name, paper)
				values (${machineId}::uuid, ${owner.value.id}::uuid, ${machine.wallet.address},
					${machine.wallet.providerWalletId}, ${machine.wallet.provider}, ${definition.value.id},
					${machine.name}, ${machine.paper ?? false})`);

		const limits: { limit: string; to: string }[] = [
			{ limit: "budgetGranted", to: machine.limits.budgetGranted.toString() },
			{ limit: "approvedMints", to: [...machine.limits.approvedMints].join(",") },
		];
		if (machine.limits.maxPerTrade !== undefined) {
			limits.push({ limit: "maxPerTrade", to: machine.limits.maxPerTrade.toString() });
		}
		if (machine.limits.maxPerDay !== undefined) {
			limits.push({ limit: "maxPerDay", to: machine.limits.maxPerDay.toString() });
		}

		const created = await appendEvent(tx, {
			machineId,
			type: "machine.created",
			leaseEpoch: 0n,
			payload: {
				ownerId: owner.value.id,
				definitionVersionId: definition.value.id,
				walletAddress: machine.wallet.address,
			},
		});
		if (!created.ok) return created;

		for (const limit of limits) {
			const written = await appendEvent(tx, {
				machineId,
				type: "machine.limits_changed",
				leaseEpoch: 0n,
				payload: { limit: limit.limit, from: null, to: limit.to },
			});
			if (!written.ok) return written;
		}

		return ok({
			machineId,
			ownerId: owner.value.id,
			walletAddress: machine.wallet.address,
			definitionId: definition.value.id,
		});
	});
}
