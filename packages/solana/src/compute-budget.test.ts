import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { checkFeeAgainstTransaction, feeFromTransaction } from "./compute-budget.ts";
import { computeBudgetTransaction } from "./testing.ts";

const WALLET = parseAddress("8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk");

describe("what a transaction says it will pay to be included", () => {
	it("reads the price and the limit out of the bytes, not out of a claim", () => {
		const transaction = computeBudgetTransaction(WALLET, {
			microLamportsPerUnit: 50_000n,
			computeUnitLimit: 200_000,
		});

		expect(feeFromTransaction(transaction)).toEqual({
			microLamportsPerUnit: 50_000n,
			computeUnitLimit: 200_000,
			lamports: 10_000n,
		});
	});

	it("says nothing was set when a transaction sets nothing", () => {
		const transaction = computeBudgetTransaction(WALLET, {});

		expect(feeFromTransaction(transaction)).toEqual({ lamports: 0n });
	});

	it("rounds a fraction of a lamport up, so a cap is never beaten by rounding", () => {
		const transaction = computeBudgetTransaction(WALLET, {
			microLamportsPerUnit: 1n,
			computeUnitLimit: 1,
		});

		expect(feeFromTransaction(transaction).lamports).toBe(1n);
	});

	it("assumes the runtime's default budget when a transaction sets a price and no limit", () => {
		// Such a transaction is given the default, and assuming zero units would read its fee as nothing
		// and let it past the cap. One instruction, so 200,000 units at 1,000 micro-lamports each.
		const transaction = computeBudgetTransaction(WALLET, { microLamportsPerUnit: 1_000n });

		const fee = feeFromTransaction(transaction);

		expect(fee).toEqual({ microLamportsPerUnit: 1_000n, lamports: 200n });
		// Left out rather than guessed at: the transaction did not say.
		expect("computeUnitLimit" in fee).toBe(false);
	});
});

describe("holding a transaction to the fee it is allowed", () => {
	const cheap = computeBudgetTransaction(WALLET, {
		microLamportsPerUnit: 50_000n,
		computeUnitLimit: 200_000,
	});

	it("accepts a fee inside the allowance", () => {
		expect(() => checkFeeAgainstTransaction(cheap, 200_000n)).not.toThrow();
	});

	it("refuses a fee over the allowance, whatever the router said it set", () => {
		const greedy = computeBudgetTransaction(WALLET, {
			microLamportsPerUnit: 5_000_000n,
			computeUnitLimit: 200_000,
		});

		expect(() => checkFeeAgainstTransaction(greedy, 200_000n)).toThrow(MaschinaError);
		expect(() => checkFeeAgainstTransaction(greedy, 200_000n)).toThrow(/for priority/);
	});

	it("accepts a transaction that asks for no priority at all", () => {
		expect(() =>
			checkFeeAgainstTransaction(computeBudgetTransaction(WALLET, {}), 0n),
		).not.toThrow();
	});
});
