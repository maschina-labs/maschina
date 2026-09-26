import { MaschinaError } from "@maschina/core";
import {
	appendTransactionMessageInstruction,
	type Blockhash,
	compileTransaction,
	createTransactionMessage,
	getTransactionEncoder,
	type Address as KitAddress,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getAssignInstruction, getTransferSolInstruction } from "@solana-program/system";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { checkUnsignedSwap } from "./swap-transaction.ts";
import { buildTransfer, checkUnsignedWithdrawal } from "./transfer.ts";

/** Builds a transaction from whatever instructions a test wants, including ones nothing should sign. */
function withInstructions(instructions: readonly unknown[]): Uint8Array {
	const empty = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(FROM as KitAddress, draft),
		(draft) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{ blockhash: BLOCKHASH as Blockhash, lastValidBlockHeight: 426_070_577n },
				draft,
			),
	);
	// The message type narrows with each instruction appended, which is a guarantee a test does not
	// need and cannot express over a list.
	let message = empty as never;
	for (const instruction of instructions) {
		message = appendTransactionMessageInstruction(instruction as never, message) as never;
	}
	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}

const sol = (lamports: bigint) =>
	getTransferSolInstruction({
		source: { address: FROM as KitAddress } as never,
		destination: TO as KitAddress,
		amount: lamports,
	});

/** Two transfers in one transaction: the shape that smuggles a second payment past a single check. */
const twoTransfers = () => withInstructions([sol(1_000_000n), sol(1_000_000n)]);

/** A system instruction that is not a transfer at all, to prove the check reads which one it is. */
const anAssignment = () =>
	withInstructions([
		getAssignInstruction({
			account: { address: FROM as KitAddress } as never,
			programAddress: TO as KitAddress,
		}),
	]);

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

describe("checking a withdrawal before it is signed", () => {
	const owner = { wallet: FROM, to: TO, lamports: 1_000_000n };

	it("accepts a transfer of exactly this amount to exactly this address", () => {
		const facts = checkUnsignedWithdrawal(transfer(), owner);

		expect(facts.feePayer).toBe(FROM);
		expect(facts.instructionCount).toBe(1);
		expect(facts.programs).toEqual(["11111111111111111111111111111111"]);
	});

	it("refuses a transfer to anywhere but the address it was told", () => {
		const elsewhere = parseAddress("9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E");

		// The whole point. A withdrawal that can go anywhere else is a way to drain a machine.
		expect(() => checkUnsignedWithdrawal(transfer({ to: elsewhere }), owner)).toThrow(
			/somewhere other than the owner/,
		);
	});

	it("refuses a transfer for a different amount than it was told", () => {
		expect(() => checkUnsignedWithdrawal(transfer({ lamports: 2_000_000n }), owner)).toThrow(
			/moves a different amount/,
		);
	});

	it("refuses a transfer out of a wallet other than the machine's", () => {
		expect(() => checkUnsignedWithdrawal(transfer(), { ...owner, wallet: TO })).toThrow(
			/different wallet to sign/,
		);
	});

	it("refuses a second instruction hidden behind the first", () => {
		const two = twoTransfers();

		expect(() => checkUnsignedWithdrawal(two, owner)).toThrow(/exactly one transfer/);
	});

	it("refuses a system instruction that is not a transfer", () => {
		expect(() => checkUnsignedWithdrawal(anAssignment(), owner)).toThrow(/not a transfer/);
	});
});
