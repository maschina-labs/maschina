/**
 * Whether a machine's profit should be moved out of reach.
 *
 * A machine given fifty dollars that makes five is trading with fifty-five, and every dollar of that
 * profit is now exposed to the next bad run. Left alone it stays exposed until a loss takes back what
 * the good runs earned, and the owner is back where they started having taken all the risk.
 *
 * A float fixes that. The float is the working amount, and it does not move: anything above it is
 * profit, gets swept somewhere it cannot be traded, and never comes back. Below the float the machine's
 * only job is getting back to the line. Nothing is added and nothing compounds, which is the opposite of
 * what a machine left to itself does.
 *
 * Two rules decide when, and both of them exist to stop a sweep taking the wrong amount.
 *
 * **Only while the machine is flat.** Holding the other side, what the float is worth depends on a price
 * nobody has agreed to yet, so the surplus is an opinion. Sweeping against an opinion takes real money
 * out of the stake when the opinion turns out to be wrong.
 *
 * **Only above a threshold.** A sweep is a transaction. Writing one for forty cents costs more in
 * attention than it protects, and on Solana the first transfer into a token account pays rent as well.
 *
 * The threshold is a share of the float rather than an amount, so it means the same thing on a fifty
 * dollar machine and a five thousand dollar one. An owner may raise it, to bank in larger pieces, and
 * may not lower it, because a smaller threshold does not make a transaction cheaper.
 */

/**
 * How far above its float a machine must be before a sweep is worth making, in basis points of the float.
 *
 * Two percent: a dollar on a fifty dollar float, which covers the rent on a token account several times
 * over and is small enough that profit does not sit in the trading account for long.
 */
export const DEFAULT_SWEEP_THRESHOLD_BPS = 200;

const BPS = 10_000n;

export type SweepCheck = {
	/** The line the machine trades at, in the currency its budget is counted in. */
	target: bigint;
	/** What the machine controls now, in that same currency, carrying any open position at cost. */
	value: bigint;
	/** True only when the machine holds nothing but that currency and has no trade in flight. */
	flat: boolean;
	/** An owner's own threshold, in basis points of the float. Never smaller than the default. */
	thresholdBps?: number | undefined;
};

export type SweepDecision =
	| { sweep: true; amount: bigint; threshold: bigint }
	/** `because` is written to be read by an owner asking why their profit is still in the machine. */
	| { sweep: false; amount: bigint; threshold: bigint; because: string };

/** What a sweep has to clear before it is worth making, in the currency the budget is counted in. */
export function sweepThreshold(target: bigint, thresholdBps?: number | undefined): bigint {
	// Anything that is not a whole number of basis points is not a threshold, so the default stands.
	const asked = Number.isInteger(thresholdBps) ? (thresholdBps as number) : 0;
	const bps = Math.max(asked, DEFAULT_SWEEP_THRESHOLD_BPS);
	return target > 0n ? (target * BigInt(bps)) / BPS : 0n;
}

/** Whether profit should be swept out of a machine now, and how much of it. */
export function sweepDue(check: SweepCheck): SweepDecision {
	const threshold = sweepThreshold(check.target, check.thresholdBps);
	const no = (because: string): SweepDecision => ({
		sweep: false,
		amount: 0n,
		threshold,
		because,
	});

	// Without a line there is nothing to be above, and a threshold of zero would sweep every cent.
	if (check.target <= 0n) return no("this machine has no float to measure profit against");
	if (!check.flat) {
		return no("the machine is holding a position, so what it is worth is still an opinion");
	}

	const surplus = check.value - check.target;
	if (surplus <= 0n) return no("the machine is not above its float");
	if (surplus < threshold) {
		return no(
			`profit of ${surplus} has not reached the ${threshold} worth sending a transaction for`,
		);
	}

	return { sweep: true, amount: surplus, threshold };
}
