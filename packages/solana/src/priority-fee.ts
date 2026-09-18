/**
 * Paying to be included quickly, without paying whatever is asked.
 *
 * A priority fee is a bid: it buys a place in a block when blocks are full. It is also money leaving the
 * machine's wallet on every single trade, whether or not the trade was any good, so it is a setting with
 * a ceiling rather than a number a router hands us.
 *
 * Two numbers describe the same bid and are easy to confuse:
 *
 *   micro-lamports per compute unit  what the transaction declares
 *   lamports                         what it actually costs, which is the first times the compute limit
 *
 * Everything an owner sees or sets is in lamports, because that is the money. The conversion happens
 * here, once, and rounds the way that never spends more than the cap.
 */

import { MaschinaError } from "@maschina/core";

export type PriorityLevel = "medium" | "high" | "veryHigh";

export type PriorityFeeSettings = {
	/** The most this trade may pay to be included, in lamports. */
	maxLamports: bigint;
	/** How hard to bid inside that cap. */
	level: PriorityLevel;
};

/**
 * The most Maschina will let any single trade bid, whatever a setting says.
 *
 * A tenth of a SOL on one trade's fee is never right, and a cap that only exists in a settings form is
 * one typo away from not existing. This is the number that cannot be typed past.
 */
export const ABSOLUTE_MAX_PRIORITY_LAMPORTS = 10_000_000n;

/** A hundredth of a SOL is the top of what a normal trade should ever bid. */
export const DEFAULT_PRIORITY_FEE: PriorityFeeSettings = {
	maxLamports: 200_000n,
	level: "high",
};

/** Refuses a fee setting that should never reach a router. */
export function checkFeeSettings(settings: PriorityFeeSettings): void {
	if (settings.maxLamports <= 0n) {
		// A cap of zero would mean a trade that can never be included when it matters.
		throw new MaschinaError("invalid_amount", "a priority fee cap must be more than zero");
	}
	if (settings.maxLamports > ABSOLUTE_MAX_PRIORITY_LAMPORTS) {
		throw new MaschinaError(
			"invalid_amount",
			`a priority fee cap above ${ABSOLUTE_MAX_PRIORITY_LAMPORTS} lamports is refused`,
			{ details: { asked: settings.maxLamports.toString() } },
		);
	}
}

/**
 * What a bid in lamports is worth per compute unit.
 *
 * Rounded down, because rounding up would let the transaction cost a little more than the cap it was
 * built from, and a cap that can be exceeded by rounding is not a cap.
 */
export function microLamportsPerUnit(maxLamports: bigint, computeUnitLimit: number): bigint {
	if (!Number.isInteger(computeUnitLimit) || computeUnitLimit <= 0) {
		throw new MaschinaError("invalid_input", "a compute unit limit is a whole number above zero");
	}
	return (maxLamports * 1_000_000n) / BigInt(computeUnitLimit);
}

/** What a declared rate will actually cost, rounded up, so nothing is ever under-counted. */
export function lamportsForFee(
	microLamportsPerComputeUnit: bigint,
	computeUnitLimit: number,
): bigint {
	if (!Number.isInteger(computeUnitLimit) || computeUnitLimit <= 0) {
		throw new MaschinaError("invalid_input", "a compute unit limit is a whole number above zero");
	}
	const total = microLamportsPerComputeUnit * BigInt(computeUnitLimit);
	return total % 1_000_000n === 0n ? total / 1_000_000n : total / 1_000_000n + 1n;
}

/**
 * Checks what a router actually charged against what it was allowed to.
 *
 * Routers are asked for a capped fee and mostly respect it. "Mostly" is not a basis for spending money,
 * so the answer is checked before the transaction is signed, and a fee above the cap means the trade
 * does not happen.
 */
export function checkFeeWithinCap(
	charged: bigint | undefined,
	settings: PriorityFeeSettings,
): void {
	if (charged === undefined) return;
	if (charged > settings.maxLamports) {
		throw new MaschinaError("limit_exceeded", "the router charged more priority fee than allowed", {
			details: { charged: charged.toString(), cap: settings.maxLamports.toString() },
		});
	}
}

/** What recent transactions actually paid, as an RPC reports it. */
export type RecentFee = { slot: bigint; microLamports: bigint };

export type FeeReader = {
	/** What was paid recently to touch these accounts, which is what competition looks like. */
	recentFees(accounts: readonly string[]): Promise<RecentFee[]>;
};

/**
 * A bid read from what recent transactions paid.
 *
 * The median is taken rather than the maximum: one desperate transaction in the last minute is not the
 * price of inclusion, and bidding against it teaches a machine to overpay. Empty history means no
 * competition worth paying for, which is a bid of nothing.
 */
export function suggestedMicroLamports(fees: readonly RecentFee[], percentile = 50): bigint {
	if (!Number.isInteger(percentile) || percentile < 0 || percentile > 100) {
		throw new MaschinaError("invalid_input", "a percentile is a whole number from 0 to 100");
	}
	const paid = fees.map((fee) => fee.microLamports).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	if (paid.length === 0) return 0n;

	const index = Math.min(paid.length - 1, Math.floor(((paid.length - 1) * percentile) / 100));
	return paid[index] ?? 0n;
}

/**
 * What to bid, and what it will cost, inside the cap.
 *
 * The suggestion is doubled before being capped: a bid exactly at the median loses to everything at the
 * median, and the cap is what actually protects the wallet.
 */
export function bidFor(
	fees: readonly RecentFee[],
	settings: PriorityFeeSettings,
	computeUnitLimit: number,
): { microLamportsPerComputeUnit: bigint; lamports: bigint } {
	checkFeeSettings(settings);

	const ceiling = microLamportsPerUnit(settings.maxLamports, computeUnitLimit);
	const suggested = suggestedMicroLamports(fees) * 2n;
	const bid = suggested > ceiling ? ceiling : suggested;

	return { microLamportsPerComputeUnit: bid, lamports: lamportsForFee(bid, computeUnitLimit) };
}
