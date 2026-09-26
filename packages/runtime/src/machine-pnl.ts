/**
 * Whether a machine has made money, worked out from its record.
 *
 * The budget says what a machine may spend. It has never said what a machine earned, and those are
 * different questions: a machine can spend its whole grant and be up, or spend a fraction of it and be
 * down. Without this, "is it working" can only be answered by looking at a balance and guessing.
 *
 * Only closed trades count. A machine holding a position may be up or down on paper, and until it sells
 * that is an opinion rather than a result, so an open position is reported as what it cost rather than
 * as profit. Cost basis is averaged across buys, so selling half a position carries half its cost.
 *
 * **Fees are reported separately, and on purpose.** They are paid in lamports and the profit is in
 * whatever the machine spends. Adding them together needs a price, and a single number that quietly
 * assumes one is worse than two numbers that do not. Anything that wants one number has to choose a
 * price and say so.
 *
 * A trade counts once, by its trade id, because the record may be read again from the beginning at any
 * time and has to give the same answer.
 */

import type { RecordedEvent } from "@maschina/contracts";

export type MachinePnl = {
	/** Realised profit or loss, in the currency the machine spends. Negative when it has lost. */
	realised: bigint;
	/** What the machine is still holding, in the token it bought. */
	position: bigint;
	/** What that open position cost, in the currency the machine spends. */
	basis: bigint;
	/** What it really cost to send the trades, in lamports. Zero for a machine on paper. */
	feesLamports: bigint;
	/** Trades that completed, real or simulated. */
	trades: number;
	/** Closed round trips, and how they went. */
	roundTrips: number;
	wins: number;
	losses: number;
	/** True when any of this came from a machine on paper, so the numbers are not money. */
	simulated: boolean;
};

const empty: MachinePnl = {
	realised: 0n,
	position: 0n,
	basis: 0n,
	feesLamports: 0n,
	trades: 0,
	roundTrips: 0,
	wins: 0,
	losses: 0,
	simulated: false,
};

type Intent = { inputMint: string; outputMint: string };

export function machinePnl(
	events: Iterable<RecordedEvent>,
	options: { budgetMint?: string | undefined },
): MachinePnl {
	const { budgetMint } = options;
	if (budgetMint === undefined) return { ...empty };

	const intents = new Map<string, Intent>();
	const counted = new Set<string>();
	const pnl = { ...empty };

	for (const event of events) {
		if (event.type === "trade.intended") {
			const { tradeId, inputMint, outputMint } = event.payload;
			// The mints live on the intent, and the amounts on the outcome, so the two are paired by id.
			if (!intents.has(tradeId)) intents.set(tradeId, { inputMint, outputMint });
			continue;
		}

		const done =
			event.type === "trade.completed"
				? {
						tradeId: event.payload.tradeId,
						spent: BigInt(event.payload.inputAmount),
						got: BigInt(event.payload.outputAmount),
						fee: BigInt(event.payload.feeLamports),
						real: true,
					}
				: event.type === "trade.simulated"
					? {
							tradeId: event.payload.tradeId,
							spent: BigInt(event.payload.inputAmount),
							got: BigInt(event.payload.quotedOutputAmount),
							// A simulated trade never paid anything. Assuming a fee would flatter paper mode.
							fee: 0n,
							real: false,
						}
					: undefined;
		if (!done) continue;

		const intent = intents.get(done.tradeId);
		if (!intent || counted.has(done.tradeId)) continue;
		counted.add(done.tradeId);

		pnl.trades += 1;
		pnl.feesLamports += done.fee;
		if (!done.real) pnl.simulated = true;

		if (intent.inputMint === budgetMint) {
			// Buying: money out, position in. Nothing is realised by opening.
			pnl.basis += done.spent;
			pnl.position += done.got;
			continue;
		}

		if (intent.outputMint === budgetMint) {
			// Selling: the share of the basis this sale carried away is what it cost.
			const sold = done.spent > pnl.position ? pnl.position : done.spent;
			const cost = pnl.position > 0n ? (pnl.basis * sold) / pnl.position : 0n;
			const gain = done.got - cost;

			pnl.realised += gain;
			pnl.basis -= cost;
			pnl.position -= sold;
			pnl.roundTrips += 1;
			if (gain > 0n) pnl.wins += 1;
			if (gain < 0n) pnl.losses += 1;
		}
		// A trade in neither direction touches something this machine's budget is not counted in, so it
		// says nothing about whether the machine made money.
	}

	return pnl;
}
