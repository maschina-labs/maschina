import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { checkUnsignedSwap } from "./swap-transaction.ts";
import { buildTransfer } from "./transfer.ts";

const FROM = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const TO = parseAddress("5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");
const BLOCKHASH = "11111111111111111111111111111111";

const transfer = (over: Partial<Parameters<typeof buildTransfer>[0]> = {}) =>
	buildTransfer({
		from: FROM,
		to: TO,
		lamports: 1_000_000n,
		blockhash: BLOCKHASH,
		lastValidBlockHeight: 426_070_577n,
		...over,
	});

describe("a transfer", () => {
	it("is unsigned, paid for by the sender, and calls only the system program", () => {
		const facts = checkUnsignedSwap(transfer(), FROM);

		expect(facts.feePayer).toBe(FROM);
		expect(facts.signaturesRequired).toBe(1);
		expect(facts.programs).toEqual(["11111111111111111111111111111111"]);
		expect(facts.instructionCount).toBe(1);
	});

	it("is refused when checked against a wallet it was not built for", () => {
		expect(() => checkUnsignedSwap(transfer(), TO)).toThrow(/different wallet to sign/);
	});

	it("refuses to move nothing", () => {
		expect(() => transfer({ lamports: 0n })).toThrow(MaschinaError);
	});

	it("refuses to send money to itself", () => {
		expect(() => transfer({ to: FROM })).toThrow(/two different addresses/);
	});
});
