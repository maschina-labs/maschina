/**
 * What a transaction asks to pay for priority, read out of the transaction.
 *
 * A router is asked for a capped fee and mostly respects it, and its answer is checked against the cap
 * when the swap is built. That check trusts the router's own description of what it did. This one does
 * not: it decodes the compute budget instructions the transaction actually carries, so the number held
 * to the cap is the number the chain will charge.
 *
 * The format is a discriminator byte and a little-endian number:
 *
 *   2  set the compute unit limit   u32
 *   3  set the price per unit       u64, in micro-lamports
 *
 * Anything else the compute budget program can be asked is ignored here: it does not affect the fee.
 */

import { MaschinaError } from "@maschina/core";
import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";
import type { Address } from "./address.ts";

const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const SET_LIMIT = 2;
const SET_PRICE = 3;
/** What the runtime gives a transaction that never says. Far larger than anything Maschina asks for. */
const DEFAULT_UNITS_PER_INSTRUCTION = 200_000;
const MAX_DEFAULT_UNITS = 1_400_000;
const MICRO_LAMPORTS = 1_000_000n;

export type TransactionFee = {
	microLamportsPerUnit?: bigint;
	computeUnitLimit?: number;
	/** What the priority fee comes to, rounded up, so a cap is never beaten by a fraction. */
	lamports: bigint;
};

/** Reads the fee a transaction will actually pay for priority. */
export function feeFromTransaction(transaction: Uint8Array): TransactionFee {
	let decoded: ReturnType<ReturnType<typeof getTransactionDecoder>["decode"]>;
	try {
		decoded = getTransactionDecoder().decode(transaction);
	} catch (cause) {
		throw new MaschinaError("invalid_input", "this is not a transaction", { cause });
	}

	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) {
		throw new MaschinaError(
			"invalid_input",
			"the transaction is in a format Maschina does not read",
		);
	}
	const accounts = message.staticAccounts as readonly Address[];

	let microLamportsPerUnit: bigint | undefined;
	let computeUnitLimit: number | undefined;
	for (const instruction of message.instructions) {
		if (accounts[instruction.programAddressIndex] !== COMPUTE_BUDGET) continue;
		const data = instruction.data;
		if (!data || data.length === 0) continue;

		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		if (data[0] === SET_LIMIT && data.length >= 5) {
			computeUnitLimit = view.getUint32(1, true);
		}
		if (data[0] === SET_PRICE && data.length >= 9) {
			microLamportsPerUnit = view.getBigUint64(1, true);
		}
	}

	if (microLamportsPerUnit === undefined || microLamportsPerUnit === 0n) {
		return {
			...(microLamportsPerUnit === undefined ? {} : { microLamportsPerUnit }),
			...(computeUnitLimit === undefined ? {} : { computeUnitLimit }),
			lamports: 0n,
		};
	}

	// A transaction that sets a price and no limit gets the runtime's default, which is larger than
	// anything Maschina would choose. Assuming the smaller number would let a fee past the cap.
	const units = BigInt(
		computeUnitLimit ??
			Math.min(message.instructions.length * DEFAULT_UNITS_PER_INSTRUCTION, MAX_DEFAULT_UNITS),
	);
	const product = microLamportsPerUnit * units;
	const lamports = (product + MICRO_LAMPORTS - 1n) / MICRO_LAMPORTS;

	return {
		microLamportsPerUnit,
		...(computeUnitLimit === undefined ? {} : { computeUnitLimit }),
		lamports,
	};
}

/**
 * Refuses a transaction that would pay more for priority than it is allowed.
 *
 * Checked against the transaction's own bytes rather than a router's description of them, because the
 * whole point of a cap is that it holds when something upstream is wrong or lying.
 */
export function checkFeeAgainstTransaction(transaction: Uint8Array, allowance: bigint): void {
	const fee = feeFromTransaction(transaction);
	if (fee.lamports > allowance) {
		throw new MaschinaError(
			"forbidden",
			`this transaction pays ${fee.lamports} for priority, and the allowance is ${allowance}`,
			{ details: { lamports: fee.lamports.toString(), allowance: allowance.toString() } },
		);
	}
}
