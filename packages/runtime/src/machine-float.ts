/**
 * A machine's float: the line it trades at, what it is worth now, and whether profit should come out.
 *
 * The float is the working amount, and it does not move. Profit above it is not the machine's to keep
 * risking, and a machine below it has one job, which is getting back to the line. Everything here is in
 * service of one number: how far above its float the machine is, right now, and how sure we are of it.
 *
 * **The value is measured, not inferred.** Money arrives in a wallet without asking Maschina, so the
 * record cannot say what a machine holds; only the chain can. The grant says what the owner allowed,
 * which is a mandate rather than a deposit, and the two come apart the moment anybody tops a machine up
 * or lowers its float. So the caller reads the balance and passes it in.
 *
 * That choice has one consequence worth being honest about: money sent to a machine's wallet without
 * raising its float looks like profit and will be swept. Nothing is lost, because the vault can only
 * ever pay the owner, but it ends up somewhere the machine cannot trade it. The alternative failure is
 * worse: a float worked out from the grant would report profit the machine does not have, and try to
 * bank money that was never there.
 *
 * **An open position is carried at what it cost.** That is what makes the float a number at every
 * moment rather than only between trades: the part of it that is in the market is worth what was paid
 * for it, and never moves on a price nobody has agreed to. It also means the value is honest rather than
 * flattering, and the machine is never told it is ahead because of an unrealised gain.
 *
 * Whether to sweep is a separate question, answered by `@maschina/rules`, and it needs the machine to be
 * flat: holding nothing but the currency it spends, with no trade in flight. Mid-trade the surplus is an
 * opinion, and a sweep against an opinion takes money out of the stake.
 */

import type { RecordedEvent } from "@maschina/contracts";
import { type BaseUnits, baseUnitsOf } from "@maschina/core";
import { type SweepDecision, sweepDue } from "@maschina/rules";
import { machineBudget } from "./machine-budget.ts";
import { machinePnl } from "./machine-pnl.ts";

export type MachineFloat = {
	/** The line the machine trades at: its grant, in the currency it spends. */
	target: BaseUnits;
	/** What the machine controls now: what its account holds, plus any open position at cost. */
	value: bigint;
	/** How much of that is in the market, at cost. */
	basis: bigint;
	/** What it is holding of the other side. Zero means the float is all in one currency. */
	position: bigint;
	/** Value above the line. This is profit, and it is what a sweep moves. */
	surplus: bigint;
	/** Value below the line. Nothing is swept until this is gone. */
	deficit: bigint;
	/** Already in the vault, from sweeps that landed. The vault's balance, rebuilt from the record. */
	banked: bigint;
	/** True when the machine holds only the currency it spends and has no trade in flight. */
	flat: boolean;
	/** Whether profit should come out now, and how much. */
	sweep: SweepDecision;
	/** True when any of these numbers came from a machine on paper, so they are not money. */
	simulated: boolean;
};

export type FloatOptions = {
	/** The currency the float is counted in, which is whatever the machine spends. */
	budgetMint?: string | undefined;
	/**
	 * What the machine's trading account holds of that currency: read from the chain for a real machine,
	 * and from its own record for one on paper, whose wallet stays empty.
	 */
	holding?: bigint | undefined;
	/** An owner's own sweep threshold, in basis points of the float. Never below the default. */
	thresholdBps?: number | undefined;
};

export function machineFloat(
	events: Iterable<RecordedEvent>,
	options: FloatOptions = {},
): MachineFloat {
	const { budgetMint, holding = 0n, thresholdBps } = options;

	// Without a currency there is nothing to measure the float in, so there is no float to report.
	if (budgetMint === undefined) return noFloat(thresholdBps);

	// Read once: both of these walk the record, and the record may be a one-shot iterator.
	const all = [...events];
	const budget = machineBudget(all, { budgetMint });
	const pnl = machinePnl(all, { budgetMint });
	const banked = bankedFrom(all);

	const target = budget.granted;
	const value = holding + pnl.basis;
	const flat = pnl.position === 0n && budget.openTrades === 0;
	const above = value - target;

	return {
		target,
		value,
		basis: pnl.basis,
		position: pnl.position,
		surplus: above > 0n ? above : 0n,
		deficit: above < 0n ? -above : 0n,
		banked,
		flat,
		sweep: sweepDue({ target, value, flat, thresholdBps }),
		simulated: pnl.simulated,
	};
}

/** What the vault holds, which is every sweep that landed. One asked for and lost moved nothing. */
function bankedFrom(events: Iterable<RecordedEvent>): bigint {
	const counted = new Set<string>();
	let banked = 0n;

	for (const event of events) {
		if (event.type !== "sweep.completed") continue;
		// The record may be read again from the beginning at any time and must give the same answer.
		if (counted.has(event.payload.sweepId)) continue;
		counted.add(event.payload.sweepId);
		banked += BigInt(event.payload.amount);
	}

	return banked;
}

const noFloat = (thresholdBps: number | undefined): MachineFloat => ({
	target: baseUnitsOf(0n),
	value: 0n,
	basis: 0n,
	position: 0n,
	surplus: 0n,
	deficit: 0n,
	banked: 0n,
	flat: true,
	sweep: sweepDue({ target: 0n, value: 0n, flat: true, thresholdBps }),
	simulated: false,
});
