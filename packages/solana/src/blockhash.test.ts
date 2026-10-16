import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { blockhashOf } from "./blockhash.ts";
import { REAL_JUPITER_BUY, REAL_JUPITER_SELL } from "./jupiter-swaps.fixture.ts";
import { transactionWith } from "./testing.ts";

const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const bytes = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));

describe("the blockhash inside a transaction", () => {
	it("is read out of the bytes, not out of anything said about them", () => {
		// What the test builder puts in every transaction it makes.
		expect(blockhashOf(transactionWith(WALLET, []))).toBe("11111111111111111111111111111111");
	});

	it("is read from real router transactions", () => {
		for (const swap of [REAL_JUPITER_BUY, REAL_JUPITER_SELL]) {
			const blockhash = blockhashOf(bytes(swap));
			// Base58, 32 bytes, so never the padded all-ones placeholder and never empty.
			expect(blockhash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
		}
	});

	it("refuses bytes that are not a transaction, rather than guessing one", () => {
		// A transaction whose expiry cannot be established is one nothing may declare expired.
		expect(() => blockhashOf(new Uint8Array([1, 2, 3]))).toThrow(
			"the transaction's blockhash could not be read",
		);
	});
});
