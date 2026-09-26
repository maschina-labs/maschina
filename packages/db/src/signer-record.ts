/**
 * The signer's view of the record: what it reads before judging a trade, and what it writes after.
 *
 * Nothing here takes the caller's word. The run, its lease, the machine's wallet, its limits, its state
 * and its budget are read from the database at the moment of asking. A request whose wallet is not the
 * machine's, or whose run belongs to another machine or is no longer held by any node, is unknown.
 *
 * Everything written is written under the lease the run holds right now, so a signer acting for a run
 * that has since moved on cannot add to the record.
 */

import type { SignRequest } from "@maschina/contracts";
import { machineLimits, machineState, settledSince } from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { haltInForce } from "./halts.ts";
import {
	budgetFor,
	recordSubmission,
	releaseTrade,
	reserveForTrade,
	settleTrade,
	submissionFor,
} from "./ledger.ts";
import { readMachineEvents } from "./read-events.ts";
import { appendEvent } from "./record.ts";

export type SignerFacts = {
	state: string;
	limits: {
		maxPerTrade?: bigint | undefined;
		maxPerDay?: bigint | undefined;
		approvedMints: readonly string[];
	};
	availableBudget: bigint;
	spentToday: bigint;
	dueAt: Date;
};

type Lease = { leaseEpoch: bigint; dueAt: Date };

type LeaseRow = { lease_epoch: string | number; due_at: string | Date };

/**
 * The run's current lease, if the request really is for this machine's wallet.
 *
 * Deciding whether to act needs a run some node still holds. Recording what the chain did with a trade
 * that was already signed does not: money moved, and that is written down whoever holds the run now.
 */
async function leaseFor(
	db: Database,
	request: SignRequest,
	options: { held: boolean } = { held: true },
): Promise<Lease | undefined> {
	const rows = await db.execute<LeaseRow>(sql`
		select runs.lease_epoch, runs.due_at from runs
		join machines on machines.id = runs.machine_id
		where runs.id = ${request.runId}::uuid
			and runs.machine_id = ${request.machineId}::uuid
			and (runs.state = 'leased' or ${!options.held})
			and machines.wallet_address = ${request.wallet}`);
	const row = rows[0];
	if (!row) return undefined;
	return {
		leaseEpoch: BigInt(row.lease_epoch),
		dueAt: row.due_at instanceof Date ? row.due_at : new Date(row.due_at),
	};
}

const startOfDayUtc = (now: Date) =>
	new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const unknownRun = (request: SignRequest) =>
	new Error(`no held run ${request.runId} for machine ${request.machineId}`);

export function signerRecord(
	db: Database,
	options: {
		/** Held back on top of every trade for what it costs to send. */
		feeAllowance: bigint;
		now?: () => Date;
	},
) {
	const now = options.now ?? (() => new Date());

	return {
		async factsFor(request: SignRequest): Promise<SignerFacts | undefined> {
			const lease = await leaseFor(db, request);
			if (!lease) return undefined;

			const events = await readMachineEvents(db, request.machineId);
			const limits = machineLimits(events);
			const budget = await budgetFor(db, request.machineId);
			return {
				state: machineState(events).state,
				limits: {
					maxPerTrade: limits.maxPerTrade,
					maxPerDay: limits.maxPerDay,
					approvedMints: limits.approvedMints,
				},
				availableBudget: budget.available,
				spentToday: settledSince(events, startOfDayUtc(now())),
				dueAt: lease.dueAt,
			};
		},

		/** The halt in force, if any. Read on every proposal, so it is a single indexed row. */
		async haltInForce() {
			return haltInForce(db);
		},

		async recordRefusal(
			request: SignRequest,
			refusal: { rule: string; reason: string; by?: "maschina" | "provider" },
		): Promise<void> {
			const lease = await leaseFor(db, request);
			if (!lease) throw unknownRun(request);
			const written = await appendEvent(db, {
				machineId: request.machineId,
				type: "trade.refused",
				leaseEpoch: lease.leaseEpoch,
				payload: {
					runId: request.runId,
					tradeId: request.tradeId,
					by: refusal.by ?? "maschina",
					rule: refusal.rule,
					reason: refusal.reason.slice(0, 500),
				},
			});
			if (!written.ok) throw written.error;
		},

		async pauseMachine(
			request: SignRequest,
			reason: "budget_exhausted" | "other",
			detail: string,
		): Promise<void> {
			const lease = await leaseFor(db, request);
			if (!lease) throw unknownRun(request);
			const written = await appendEvent(db, {
				machineId: request.machineId,
				type: "machine.paused",
				leaseEpoch: lease.leaseEpoch,
				payload: { reason, detail: detail.slice(0, 500) },
			});
			if (!written.ok) throw written.error;
		},

		async hold(request: SignRequest): Promise<{ reserved: bigint } | undefined> {
			const lease = await leaseFor(db, request);
			if (!lease) return undefined;
			const reserved = await reserveForTrade(db, {
				machineId: request.machineId,
				runId: request.runId,
				tradeId: request.tradeId,
				leaseEpoch: lease.leaseEpoch,
				inputMint: request.trade.inputMint,
				outputMint: request.trade.outputMint,
				inputAmount: BigInt(request.trade.inputAmount),
				quotedOutputAmount: BigInt(request.trade.quotedOutputAmount),
				slippageBps: request.trade.slippageBps,
				feeAllowance: options.feeAllowance,
			});
			if (reserved.ok) return { reserved: reserved.value.reserved };
			// Not enough budget is a refusal. Anything else is a fault, and must not look like one.
			if (reserved.error.code === "limit_exceeded") return undefined;
			throw reserved.error;
		},

		async giveBack(request: SignRequest, reason: string): Promise<void> {
			const lease = await leaseFor(db, request);
			if (!lease) throw unknownRun(request);
			const released = await releaseTrade(db, {
				machineId: request.machineId,
				runId: request.runId,
				tradeId: request.tradeId,
				leaseEpoch: lease.leaseEpoch,
				stage: "sign",
				reason: reason.slice(0, 500),
			});
			if (!released.ok) throw released.error;
		},

		/** The machine's wallet at the provider, when the request really is for this machine's wallet. */
		async walletIdFor(request: SignRequest): Promise<string | undefined> {
			const rows = await db.execute<{ provider_wallet_id: string }>(sql`
				select provider_wallet_id from machines
				where id = ${request.machineId}::uuid and wallet_address = ${request.wallet}`);
			return rows[0]?.provider_wallet_id;
		},

		async submissionFor(request: SignRequest) {
			return submissionFor(db, request.machineId, request.tradeId);
		},

		async recordSubmission(
			request: SignRequest,
			submission: { signature: string; lastValidBlockHeight: bigint },
		): Promise<void> {
			const lease = await leaseFor(db, request);
			if (!lease) throw unknownRun(request);
			const written = await recordSubmission(db, {
				machineId: request.machineId,
				runId: request.runId,
				tradeId: request.tradeId,
				leaseEpoch: lease.leaseEpoch,
				...submission,
			});
			if (!written.ok) throw written.error;
		},

		/** Settles the trade at what the chain says it cost. */
		async settle(
			request: SignRequest,
			signature: string,
			cost: { inputAmount: bigint; outputAmount: bigint; feeLamports: bigint },
		): Promise<void> {
			const lease = await leaseFor(db, request, { held: false });
			if (!lease) throw unknownRun(request);
			const settled = await settleTrade(db, {
				machineId: request.machineId,
				runId: request.runId,
				tradeId: request.tradeId,
				leaseEpoch: lease.leaseEpoch,
				signature,
				...cost,
			});
			if (!settled.ok) throw settled.error;
		},

		/** Gives the hold back for a trade the chain says did not happen. */
		async release(
			request: SignRequest,
			stage: "submit" | "confirm",
			reason: string,
			signature: string,
		): Promise<void> {
			const lease = await leaseFor(db, request, { held: false });
			if (!lease) throw unknownRun(request);
			const released = await releaseTrade(db, {
				machineId: request.machineId,
				runId: request.runId,
				tradeId: request.tradeId,
				leaseEpoch: lease.leaseEpoch,
				stage,
				reason: reason.slice(0, 500),
				signature,
			});
			if (!released.ok) throw released.error;
		},
	};
}
