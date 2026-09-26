/**
 * Holding budget before a trade, and settling it afterwards.
 *
 * A budget is only a limit if two trades cannot both spend the last of it. Nothing in the code can
 * promise that on its own: between reading a balance and writing an intent there is always a gap, and
 * under load something will land in it. So the promise is made by the database.
 *
 * Every reservation takes the machine's row for the length of one transaction. Two signers asking about
 * the same machine at the same moment are made to take turns, and the second one reads a record that
 * already contains the first one's intent. Machines do not wait on each other: the lock is per machine,
 * which is the only scope where budgets can collide.
 *
 * The budget itself is never stored. It is derived from the record inside the same transaction, by the
 * same function that derives it everywhere else, so there is one definition of what a machine can afford
 * rather than one in code and another in SQL.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import { budgetMintOf, KNOWN_KINDS, type MachineBudget, machineBudget } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Database, Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";
import { appendEvent } from "./record.ts";

export type TradeToReserve = {
	machineId: string;
	runId: string;
	tradeId: string;
	/** The epoch of the lease the caller holds, so a cut off node cannot reserve. */
	leaseEpoch: bigint;
	inputMint: string;
	outputMint: string;
	/** What the trade spends, in the budget's units. */
	inputAmount: bigint;
	quotedOutputAmount: bigint;
	slippageBps: number;
	/** Held back on top, for what the transaction costs to send. */
	feeAllowance: bigint;
};

export type Reservation = {
	tradeId: string;
	/** What is now held for this trade: the amount plus the fee allowance. */
	reserved: bigint;
	/** What the machine may still spend after this reservation. */
	remaining: bigint;
};

/**
 * Holds budget for a trade, or refuses it.
 *
 * On the way out the trade is in the record as intended, which is what reserves the money. Nothing is
 * signed yet, so a crash from here on leaves a reservation that recovery releases, never a spend
 * nobody knows about.
 */
export async function reserveForTrade(
	db: Database,
	trade: TradeToReserve,
): Promise<Result<Reservation, MaschinaError>> {
	if (trade.inputAmount <= 0n) {
		return err(new MaschinaError("invalid_amount", "a trade spends more than nothing"));
	}
	if (trade.feeAllowance < 0n) {
		return err(new MaschinaError("invalid_amount", "a fee allowance is never negative"));
	}

	const wanted = trade.inputAmount + trade.feeAllowance;

	return db.transaction(async (tx) => {
		const held = await lockMachine(tx, trade.machineId);
		if (!held) {
			return err(
				new MaschinaError("not_found", "no such machine", {
					details: { machineId: trade.machineId },
				}),
			);
		}

		const budget = await budgetOf(tx, trade.machineId);
		if (wanted > budget.available) {
			return err(
				new MaschinaError("limit_exceeded", "the budget cannot cover this trade", {
					details: {
						machineId: trade.machineId,
						wanted: wanted.toString(),
						available: budget.available.toString(),
					},
				}),
			);
		}

		const written = await appendEvent(tx, {
			machineId: trade.machineId,
			type: "trade.intended",
			leaseEpoch: trade.leaseEpoch,
			payload: {
				runId: trade.runId,
				tradeId: trade.tradeId,
				inputMint: trade.inputMint,
				outputMint: trade.outputMint,
				inputAmount: trade.inputAmount.toString(),
				quotedOutputAmount: trade.quotedOutputAmount.toString(),
				slippageBps: trade.slippageBps,
				feeAllowance: trade.feeAllowance.toString(),
			},
		});
		if (!written.ok) return written;

		return ok({
			tradeId: trade.tradeId,
			reserved: wanted,
			remaining: budget.available - wanted,
		});
	});
}

export type SettledTrade = {
	machineId: string;
	runId: string;
	tradeId: string;
	leaseEpoch: bigint;
	signature: string;
	/** What the trade actually spent. */
	inputAmount: bigint;
	outputAmount: bigint;
	/** What it actually cost to send. */
	feeLamports: bigint;
};

/**
 * Turns a reservation into a spend.
 *
 * What the trade really cost replaces what was held for it, and anything held back beyond that goes
 * straight back to the budget. A trade that somehow cost more than was reserved settles at the
 * reservation: the record shows what happened, and the budget never goes negative behind it.
 */
export async function settleTrade(
	db: Executor,
	trade: SettledTrade,
): Promise<Result<{ tradeId: string }, MaschinaError>> {
	const written = await appendEvent(db, {
		machineId: trade.machineId,
		type: "trade.completed",
		leaseEpoch: trade.leaseEpoch,
		payload: {
			runId: trade.runId,
			tradeId: trade.tradeId,
			signature: trade.signature,
			inputAmount: trade.inputAmount.toString(),
			outputAmount: trade.outputAmount.toString(),
			feeLamports: trade.feeLamports.toString(),
		},
	});
	return written.ok ? ok({ tradeId: trade.tradeId }) : written;
}

export type ReleasedTrade = {
	machineId: string;
	runId: string;
	tradeId: string;
	leaseEpoch: bigint;
	/** Where it got to before it failed, which decides what recovery has to ask the chain. */
	stage: "quote" | "sign" | "submit" | "confirm";
	reason: string;
	signature?: string;
};

/**
 * Gives a reservation back for a trade that did not happen.
 *
 * Only ever called when the trade certainly did not happen. A trade that might have landed is not
 * released, because releasing it would let the machine spend money it may already have spent. That case
 * is reconciled against the chain first.
 */
export async function releaseTrade(
	db: Executor,
	trade: ReleasedTrade,
): Promise<Result<{ tradeId: string }, MaschinaError>> {
	const written = await appendEvent(db, {
		machineId: trade.machineId,
		type: "trade.failed",
		leaseEpoch: trade.leaseEpoch,
		payload: {
			runId: trade.runId,
			tradeId: trade.tradeId,
			stage: trade.stage,
			reason: trade.reason,
			...(trade.signature ? { signature: trade.signature } : {}),
		},
	});
	return written.ok ? ok({ tradeId: trade.tradeId }) : written;
}

/** What a machine can afford right now, derived from its record. */
export async function budgetFor(db: Executor, machineId: string): Promise<MachineBudget> {
	return budgetOf(db, machineId);
}

/**
 * Takes the machine's row until the transaction ends.
 *
 * This is the whole reason two trades cannot spend the same money: everything that reserves budget for a
 * machine passes through here, one at a time.
 */
async function lockMachine(db: Executor, machineId: string): Promise<boolean> {
	const rows = await db.execute<{ id: string }>(
		sql`select id from machines where id = ${machineId}::uuid for update`,
	);
	return rows.length > 0;
}

async function budgetOf(db: Executor, machineId: string): Promise<MachineBudget> {
	const rows = await db.execute<{ kind: string; settings: unknown }>(sql`
		select machine_definitions.kind, machine_definitions.settings
		from machines
		join machine_definitions on machine_definitions.id = machines.definition_id
		where machines.id = ${machineId}::uuid`);
	const row = rows[0];
	// Money that came back in the machine's own currency returns to what it may spend.
	const budgetMint = row ? budgetMintOf(KNOWN_KINDS, row.kind, row.settings) : undefined;
	const events = await readMachineEvents(db, machineId);
	return machineBudget(events, budgetMint === undefined ? {} : { budgetMint });
}

export type TradeSubmission = {
	machineId: string;
	runId: string;
	tradeId: string;
	leaseEpoch: bigint;
	/** The signature the chain will know this trade by, read from the signed bytes before sending. */
	signature: string;
	lastValidBlockHeight: bigint;
};

/**
 * Writes down that a trade has been signed and is about to be sent.
 *
 * Taken under the machine's lock and refused if this trade already has a signature, so "sent at most
 * once" is something the database enforces rather than something the code remembers to check. Two
 * signers racing on the same trade cannot both get through, and the one that loses is told which
 * signature already exists so it can ask the chain about that one instead.
 */
export async function recordSubmission(
	db: Database,
	submission: TradeSubmission,
): Promise<Result<{ signature: string }, MaschinaError>> {
	return db.transaction(async (tx) => {
		const held = await lockMachine(tx, submission.machineId);
		if (!held) {
			return err(
				new MaschinaError("not_found", "no such machine", {
					details: { machineId: submission.machineId },
				}),
			);
		}

		const already = await submissionOf(tx, submission.machineId, submission.tradeId);
		if (already) {
			return err(
				new MaschinaError("conflict", "this trade has already been signed once", {
					details: { tradeId: submission.tradeId, signature: already.signature },
				}),
			);
		}

		const written = await appendEvent(tx, {
			machineId: submission.machineId,
			type: "trade.submitted",
			leaseEpoch: submission.leaseEpoch,
			payload: {
				runId: submission.runId,
				tradeId: submission.tradeId,
				signature: submission.signature,
				lastValidBlockHeight: submission.lastValidBlockHeight.toString(),
			},
		});
		if (!written.ok) return written;

		return ok({ signature: submission.signature });
	});
}

/** The signature already written down for a trade, when there is one. */
export async function submissionFor(
	db: Executor,
	machineId: string,
	tradeId: string,
): Promise<{ signature: string; lastValidBlockHeight: bigint } | undefined> {
	return submissionOf(db, machineId, tradeId);
}

async function submissionOf(
	db: Executor,
	machineId: string,
	tradeId: string,
): Promise<{ signature: string; lastValidBlockHeight: bigint } | undefined> {
	for (const event of await readMachineEvents(db, machineId)) {
		if (event.type !== "trade.submitted") continue;
		if (event.payload.tradeId !== tradeId) continue;
		return {
			signature: event.payload.signature,
			lastValidBlockHeight: BigInt(event.payload.lastValidBlockHeight),
		};
	}
	return undefined;
}
