/**
 * Moving a machine's profit into its vault.
 *
 * Two instructions and nothing else: make the vault's account for the token if it does not exist yet,
 * and move the amount into it with a checked transfer. Checked, because a checked transfer names the
 * mint, and the wallet provider can only hold a token transfer to its approved mints when the mint is
 * named. A plain transfer would be refused by the provider, which is the right answer to a transfer it
 * cannot see.
 *
 * The check is the part that matters. A sweep is decided from the machine's float and the record, and
 * the bytes are then taken apart and compared against that decision before anything is signed: from the
 * machine's own account, into the vault's own account, this token, this amount, one transfer. Whatever
 * built them, only bytes that match the decision are signed.
 *
 * Nothing here signs or sends.
 */

import { MaschinaError } from "@maschina/core";
import {
	AccountRole,
	appendTransactionMessageInstruction,
	type Blockhash,
	compileTransaction,
	createTransactionMessage,
	getCompiledTransactionMessageDecoder,
	getTransactionDecoder,
	getTransactionEncoder,
	type Address as KitAddress,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import type { Address } from "./address.ts";
import { checkUnsignedSwap, type TransactionFacts } from "./swap-transaction.ts";
import {
	ASSOCIATED_TOKEN_PROGRAM,
	TOKEN_2022_PROGRAM,
	TOKEN_PROGRAM,
	tokenAccountFor,
} from "./token-account.ts";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
/** Token program: move tokens, naming the mint and its decimals. */
const TRANSFER_CHECKED = 12;
/** Associated token program: create the account unless it already exists. */
const CREATE_IDEMPOTENT = 1;

export type SweepRequest = {
	/** The machine's trading account: it pays, it signs, and its tokens move. */
	wallet: Address;
	/** The vault beside it. The only place a sweep may go. */
	vault: Address;
	mint: Address;
	/** The mint's decimals, read from the chain. A checked transfer refuses the wrong number. */
	decimals: number;
	amount: bigint;
	/** Which token program the mint belongs to. The classic one unless said otherwise. */
	tokenProgram?: string;
	blockhash: string;
	lastValidBlockHeight: bigint;
};

/** An unsigned sweep, as wire bytes. */
export async function buildSweep(request: SweepRequest): Promise<Uint8Array> {
	if (request.amount <= 0n) {
		throw new MaschinaError("invalid_amount", "a sweep moves more than nothing");
	}
	if (request.vault === request.wallet) {
		throw new MaschinaError("invalid_input", "a vault that is the machine itself is not a vault");
	}

	const tokenProgram = (request.tokenProgram ?? TOKEN_PROGRAM) as KitAddress;
	const from = await tokenAccountFor({ owner: request.wallet, mint: request.mint, tokenProgram });
	const into = await tokenAccountFor({ owner: request.vault, mint: request.mint, tokenProgram });
	const wallet = request.wallet as KitAddress;
	const mint = request.mint as KitAddress;

	const transfer = new Uint8Array(10);
	transfer[0] = TRANSFER_CHECKED;
	new DataView(transfer.buffer).setBigUint64(1, request.amount, true);
	transfer[9] = request.decimals;

	const message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(wallet, draft),
		(draft) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{
					blockhash: request.blockhash as Blockhash,
					lastValidBlockHeight: request.lastValidBlockHeight,
				},
				draft,
			),
		// The vault's account is made the first time it is swept into, paid for by the machine.
		(draft) =>
			appendTransactionMessageInstruction(
				{
					programAddress: ASSOCIATED_TOKEN_PROGRAM as KitAddress,
					accounts: [
						{ address: wallet, role: AccountRole.WRITABLE_SIGNER },
						{ address: into as KitAddress, role: AccountRole.WRITABLE },
						{ address: request.vault as KitAddress, role: AccountRole.READONLY },
						{ address: mint, role: AccountRole.READONLY },
						{ address: SYSTEM_PROGRAM as KitAddress, role: AccountRole.READONLY },
						{ address: tokenProgram, role: AccountRole.READONLY },
					],
					data: new Uint8Array([CREATE_IDEMPOTENT]),
				},
				draft,
			),
		(draft) =>
			appendTransactionMessageInstruction(
				{
					programAddress: tokenProgram,
					accounts: [
						{ address: from as KitAddress, role: AccountRole.WRITABLE },
						{ address: mint, role: AccountRole.READONLY },
						{ address: into as KitAddress, role: AccountRole.WRITABLE },
						{ address: wallet, role: AccountRole.WRITABLE_SIGNER },
					],
					data: transfer,
				},
				draft,
			),
	);

	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}

export type SweepCheck = {
	wallet: Address;
	vault: Address;
	mint: Address;
	amount: bigint;
	tokenProgram?: string;
};

function refuse(message: string, details: Record<string, unknown> = {}): never {
	throw new MaschinaError("forbidden", message, { details });
}

/**
 * Refuses a sweep's bytes unless they are exactly what was decided: one checked transfer of this token,
 * from the machine's own account into the vault's, for this amount, and at most the creation of the
 * vault's own account beside it.
 */
export async function checkUnsignedSweep(
	transaction: Uint8Array,
	check: SweepCheck,
): Promise<TransactionFacts> {
	// Unsigned, one signature, and that signature the machine's.
	const facts = checkUnsignedSwap(transaction, check.wallet);

	const tokenProgram = check.tokenProgram ?? TOKEN_PROGRAM;
	const allowed = new Set([tokenProgram, ASSOCIATED_TOKEN_PROGRAM, COMPUTE_BUDGET]);
	for (const program of facts.programs) {
		if (!allowed.has(program)) {
			refuse("a sweep calls a program it has no business in", { program });
		}
	}
	if (tokenProgram !== TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) {
		refuse("a sweep names a token program that is not one", { tokenProgram });
	}

	const from = await tokenAccountFor({ owner: check.wallet, mint: check.mint, tokenProgram });
	const into = await tokenAccountFor({ owner: check.vault, mint: check.mint, tokenProgram });

	const decoded = getTransactionDecoder().decode(transaction);
	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) refuse("the sweep is in a format Maschina does not read");
	const keys = message.staticAccounts as readonly KitAddress[];

	let transfers = 0;
	for (const instruction of message.instructions) {
		const program = keys[instruction.programAddressIndex];
		const data = instruction.data ?? new Uint8Array();
		const account = (position: number): string | undefined => {
			const index = instruction.accountIndices?.[position];
			return index === undefined ? undefined : keys[index];
		};

		if (program === tokenProgram) {
			if (data[0] !== TRANSFER_CHECKED || data.length !== 10) {
				refuse("a sweep moves tokens with a checked transfer and nothing else");
			}
			transfers += 1;
			const amount = new DataView(data.buffer, data.byteOffset).getBigUint64(1, true);
			if (amount !== check.amount) {
				refuse("the sweep's amount is not the amount decided", {
					decided: check.amount.toString(),
					built: amount.toString(),
				});
			}
			if (account(0) !== from || account(3) !== check.wallet) {
				refuse("the sweep moves tokens out of an account that is not the machine's");
			}
			if (account(1) !== check.mint) refuse("the sweep moves a token other than the one decided");
			if (account(2) !== into) refuse("the sweep pays into an account that is not the vault's");
			continue;
		}

		if (program === ASSOCIATED_TOKEN_PROGRAM) {
			if (data[0] !== CREATE_IDEMPOTENT) refuse("a sweep only ever makes the vault's own account");
			if (
				account(0) !== check.wallet ||
				account(1) !== into ||
				account(2) !== check.vault ||
				account(3) !== check.mint
			) {
				refuse("the sweep makes an account that is not the vault's");
			}
		}
	}

	if (transfers !== 1) {
		refuse("a sweep is exactly one transfer", { transfers });
	}
	return facts;
}
