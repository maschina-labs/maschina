/**
 * Token amounts, held as whole numbers of the token's smallest unit.
 *
 * Floating point cannot represent most decimal amounts exactly, and a rounding error in a product
 * that moves money is a real loss. Every amount in Maschina is a bigint of base units (lamports for
 * SOL, micro-units for USDC), and conversion to and from human-readable decimals happens only at the
 * edges.
 */

import { MaschinaError } from "./errors.ts";

declare const baseUnits: unique symbol;

/** A non-negative amount in a token's smallest unit. */
export type BaseUnits = bigint & { readonly [baseUnits]: true };

export type Rounding = "down" | "up";

const MAX_DECIMALS = 18;
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

function assertDecimals(decimals: number): void {
	if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
		throw new MaschinaError(
			"invalid_amount",
			`decimals must be an integer from 0 to ${MAX_DECIMALS}`,
		);
	}
}

/** Wraps a bigint as base units, refusing negative values. */
export function baseUnitsOf(value: bigint): BaseUnits {
	if (value < 0n) throw new MaschinaError("invalid_amount", "an amount cannot be negative");
	return value as BaseUnits;
}

/**
 * Parses a decimal string such as "1.5" into base units.
 * More fractional digits than the token supports is an error, never a silent rounding.
 */
export function parseAmount(input: string, decimals: number): BaseUnits {
	assertDecimals(decimals);
	const match = DECIMAL.exec(input.trim());
	if (!match) throw new MaschinaError("invalid_amount", `"${input}" is not a decimal amount`);
	const whole = match[1] ?? "0";
	const fraction = match[2] ?? "";
	if (fraction.length > decimals) {
		throw new MaschinaError(
			"invalid_amount",
			`"${input}" has ${fraction.length} decimal places, this token allows ${decimals}`,
		);
	}
	return baseUnitsOf(BigInt(whole + fraction.padEnd(decimals, "0")));
}

/** Formats base units as a decimal string with no trailing zeros. */
export function formatAmount(amount: BaseUnits, decimals: number): string {
	assertDecimals(decimals);
	if (decimals === 0) return amount.toString();
	const digits = amount.toString().padStart(decimals + 1, "0");
	const whole = digits.slice(0, -decimals);
	const fraction = digits.slice(-decimals).replace(/0+$/, "");
	return fraction ? `${whole}.${fraction}` : whole;
}

export function addAmounts(a: BaseUnits, b: BaseUnits): BaseUnits {
	return baseUnitsOf(a + b);
}

/** Subtracts, refusing to go below zero. A budget that goes negative is a bug, not a number. */
export function subtractAmounts(from: BaseUnits, amount: BaseUnits): BaseUnits {
	if (amount > from) {
		throw new MaschinaError("insufficient_amount", `cannot subtract ${amount} from ${from}`);
	}
	return baseUnitsOf(from - amount);
}

/**
 * Applies a rate in basis points (1 bps = 0.01%).
 * The caller chooses the rounding: fees and reservations round up, payouts round down.
 */
export function applyBasisPoints(amount: BaseUnits, bps: number, rounding: Rounding): BaseUnits {
	if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
		throw new MaschinaError("invalid_amount", "basis points must be an integer from 0 to 10000");
	}
	const numerator = amount * BigInt(bps);
	const quotient = numerator / 10_000n;
	const remainder = numerator % 10_000n;
	return baseUnitsOf(rounding === "up" && remainder > 0n ? quotient + 1n : quotient);
}
