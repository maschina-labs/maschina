import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	address,
	blockhash,
	decompileTransactionMessage,
	getCompiledTransactionMessageDecoder,
	getTransactionDecoder,
	type Instruction,
} from "@solana/kit";
import { SOLANA_PROGRAMS } from "../policy.ts";
import {
	MEMO_PROGRAM,
	memoOnly,
	tokenTransfer,
	transferSol,
	WRAPPED_SOL,
	wrappedSolAccount,
} from "./transactions.ts";

const WALLET = address("6Xa6BehnAkS9tUui8hYgNs9qjFmuxZe2pGZm9k8u2uvh");
const OWNER = address("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
const BLOCKHASH = {
	blockhash: blockhash("EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k"),
	lastValidBlockHeight: 100n,
};

/** Decodes an unsigned transaction back into its instructions, the way a signer would see it. */
function read(hex: string) {
	const transaction = getTransactionDecoder().decode(Buffer.from(hex, "hex"));
	const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
	const message = decompileTransactionMessage(compiled);
	const instructions = [...message.instructions] as Instruction[];
	return {
		signatures: transaction.signatures,
		feePayer: message.feePayer.address,
		programs: instructions.map((instruction) => instruction.programAddress),
		instructions,
	};
}

describe("transferSol", () => {
	it("moves SOL from the wallet, which pays the fee and hasn't signed yet", async () => {
		const tx = read(
			await transferSol({ from: WALLET, to: OWNER, lamports: 1_000_000n, blockhash: BLOCKHASH }),
		);
		assert.equal(tx.feePayer, WALLET);
		assert.deepEqual(tx.programs, [SOLANA_PROGRAMS.system]);
		assert.deepEqual(Object.keys(tx.signatures), [WALLET]);
		assert.equal(tx.signatures[WALLET], null);
		const accounts = tx.instructions[0]?.accounts?.map((account) => account.address);
		assert.deepEqual(accounts, [WALLET, OWNER]);
	});

	it("encodes the amount exactly", async () => {
		const tx = read(
			await transferSol({ from: WALLET, to: OWNER, lamports: 49_000_001n, blockhash: BLOCKHASH }),
		);
		const data = tx.instructions[0]?.data ?? new Uint8Array();
		assert.equal(Buffer.from(data).readBigUInt64LE(4), 49_000_001n);
	});
});

describe("memoOnly", () => {
	it("calls only the memo program, which the policy doesn't allow", async () => {
		const tx = read(await memoOnly({ payer: WALLET, text: "maschina", blockhash: BLOCKHASH }));
		assert.deepEqual(tx.programs, [MEMO_PROGRAM]);
		assert.ok(!(Object.values(SOLANA_PROGRAMS) as string[]).includes(MEMO_PROGRAM));
	});
});

describe("tokenTransfer", () => {
	it("wraps SOL into the wallet's own account and sends it to the owner as a checked transfer", async () => {
		const tx = read(
			await tokenTransfer({
				wallet: WALLET,
				owner: OWNER,
				mint: WRAPPED_SOL,
				amount: 1_000_000n,
				blockhash: BLOCKHASH,
			}),
		);
		assert.deepEqual(tx.programs, [
			SOLANA_PROGRAMS.associatedToken,
			SOLANA_PROGRAMS.system,
			SOLANA_PROGRAMS.token,
			SOLANA_PROGRAMS.associatedToken,
			SOLANA_PROGRAMS.token,
		]);
		const own = await wrappedSolAccount(WALLET);
		const wrap = tx.instructions[1]?.accounts?.map((account) => account.address);
		assert.deepEqual(wrap, [WALLET, own]);
	});

	it("can name any mint, so a refusal test can use one the policy doesn't allow", async () => {
		// Not a real mint, and not approved by any policy.
		const other = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
		const tx = read(
			await tokenTransfer({
				wallet: WALLET,
				owner: OWNER,
				mint: other,
				amount: 1n,
				blockhash: BLOCKHASH,
				wrap: false,
			}),
		);
		assert.deepEqual(tx.programs, [SOLANA_PROGRAMS.associatedToken, SOLANA_PROGRAMS.token]);
		assert.ok(tx.instructions[1]?.accounts?.some((account) => account.address === other));
	});
});

describe("wrappedSolAccount", () => {
	it("is the wallet's associated token account for wrapped SOL, the same every time", async () => {
		const first = await wrappedSolAccount(WALLET);
		assert.equal(first, await wrappedSolAccount(WALLET));
		assert.notEqual(first, await wrappedSolAccount(OWNER));
	});
});
