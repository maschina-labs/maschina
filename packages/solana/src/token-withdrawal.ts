/**
 * Sending a machine's tokens home.
 *
 * A withdrawal of SOL is one transfer. A withdrawal of tokens is one transaction per account holding
 * them, the trading account or the vault, and in it, for every token account:
 *
 *   make the owner's account for that token, if it does not exist yet
 *   move the whole balance into it with a checked transfer
 *   close the now empty account, so its rent comes home too
 *
 * Wrapped SOL is only closed. Closing it pays out every lamport in it, which is the SOL itself, so it
 * arrives in the owner's wallet as SOL rather than as a token they then have to unwrap.
 *
 * The trading account always pays the fee. The vault never holds SOL, because nothing ever sends it any,
 * so when the vault is emptied the trading account pays and the vault signs only for its own tokens.
 *
 * The check is what makes it safe to sign. It takes the bytes apart and refuses them unless every token
 * goes to the owner, every account closes into the owner, the amounts are the balances that were read,
 * and nothing else happens. SOL does not move here at all; that is the plain transfer that comes last.
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
import {
	ASSOCIATED_TOKEN_PROGRAM,
	TOKEN_2022_PROGRAM,
	TOKEN_PROGRAM,
	tokenAccountFor,
} from "./token-account.ts";
import { WRAPPED_SOL } from "./trade-cost.ts";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const TRANSFER_CHECKED = 12;
const CLOSE_ACCOUNT = 9;
const CREATE_IDEMPOTENT = 1;

export type WithdrawnToken = {
	/** The token account holding it, as read from the chain. */
	account: Address;
	mint: Address;
	/** The whole balance. A withdrawal of everything leaves nothing behind. */
	amount: bigint;
	decimals: number;
	/** Which token program the account belongs to, which decides the owner's account for it. */
	program: string;
};

export type TokenWithdrawal = {
	/** The trading account. It pays the fee, and signs. */
	payer: Address;
	/** Whose tokens these are: the trading account, or the vault. */
	from: Address;
	/** The owner's own wallet. The only place any of it may go. */
	owner: Address;
	tokens: readonly WithdrawnToken[];
	blockhash: string;
	lastValidBlockHeight: bigint;
};

export type TokenWithdrawalFacts = {
	signers: Address[];
	instructionCount: number;
};

const isWrappedSol = (token: WithdrawnToken) => token.mint === WRAPPED_SOL;

function refuse(message: string, details: Record<string, unknown> = {}): never {
	throw new MaschinaError("forbidden", message, { details });
}

/** An unsigned transaction that sends every token in one account home, as wire bytes. */
export async function buildTokenWithdrawal(request: TokenWithdrawal): Promise<Uint8Array> {
	if (request.owner === request.from || request.owner === request.payer) {
		throw new MaschinaError("invalid_input", "the owner's wallet cannot be the machine's own");
	}

	type Draft = Parameters<typeof appendTransactionMessageInstruction>[1];
	type Compilable = Parameters<typeof compileTransaction>[0];
	const payer = request.payer as KitAddress;
	const from = request.from as KitAddress;
	const owner = request.owner as KitAddress;
	// The payer signs for the fee. The account whose tokens move signs for them, and is writable only
	// because closing an account can pay into it; here closing always pays the owner.
	const authority = from === payer ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER;

	let message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(payer, draft),
		(draft) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{
					blockhash: request.blockhash as Blockhash,
					lastValidBlockHeight: request.lastValidBlockHeight,
				},
				draft,
			),
	) as Draft;

	for (const token of request.tokens) {
		const program = token.program as KitAddress;
		const account = token.account as KitAddress;

		if (token.amount > 0n && !isWrappedSol(token)) {
			const into = (await tokenAccountFor({
				owner: request.owner,
				mint: token.mint,
				tokenProgram: token.program,
			})) as KitAddress;
			message = appendTransactionMessageInstruction(
				{
					programAddress: ASSOCIATED_TOKEN_PROGRAM as KitAddress,
					accounts: [
						{ address: payer, role: AccountRole.WRITABLE_SIGNER },
						{ address: into, role: AccountRole.WRITABLE },
						{ address: owner, role: AccountRole.READONLY },
						{ address: token.mint as KitAddress, role: AccountRole.READONLY },
						{ address: SYSTEM_PROGRAM as KitAddress, role: AccountRole.READONLY },
						{ address: program, role: AccountRole.READONLY },
					],
					data: new Uint8Array([CREATE_IDEMPOTENT]),
				},
				message,
			) as Draft;

			const data = new Uint8Array(10);
			data[0] = TRANSFER_CHECKED;
			new DataView(data.buffer).setBigUint64(1, token.amount, true);
			data[9] = token.decimals;
			message = appendTransactionMessageInstruction(
				{
					programAddress: program,
					accounts: [
						{ address: account, role: AccountRole.WRITABLE },
						{ address: token.mint as KitAddress, role: AccountRole.READONLY },
						{ address: into, role: AccountRole.WRITABLE },
						{ address: from, role: authority },
					],
					data,
				},
				message,
			) as Draft;
		}

		// Closed last, empty, into the owner: the rent, and for wrapped SOL the SOL, comes home.
		message = appendTransactionMessageInstruction(
			{
				programAddress: program,
				accounts: [
					{ address: account, role: AccountRole.WRITABLE },
					{ address: owner, role: AccountRole.WRITABLE },
					{ address: from, role: authority },
				],
				data: new Uint8Array([CLOSE_ACCOUNT]),
			},
			message,
		) as Draft;
	}

	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message as Compilable)));
}

/**
 * Refuses a token withdrawal unless it is exactly what was asked: every token account that was read,
 * emptied into the owner's own account for that token, and closed into the owner, with nothing else.
 */
export async function checkUnsignedTokenWithdrawal(
	transaction: Uint8Array,
	expected: TokenWithdrawal,
): Promise<TokenWithdrawalFacts> {
	let decoded: ReturnType<ReturnType<typeof getTransactionDecoder>["decode"]>;
	try {
		decoded = getTransactionDecoder().decode(transaction);
	} catch (cause) {
		throw new MaschinaError("invalid_input", "the withdrawal could not be read", { cause });
	}
	const signatures = Object.entries(decoded.signatures);
	if (signatures.some(([, signature]) => signature !== null)) {
		refuse("the withdrawal is already signed");
	}
	const signers = signatures.map(([address]) => address as Address);
	const allowedSigners = new Set<string>([expected.payer, expected.from]);
	if (signers.some((signer) => !allowedSigners.has(signer))) {
		refuse("the withdrawal asks somebody else to sign", { signers });
	}

	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) refuse("the withdrawal is in a format Maschina does not read");
	const keys = message.staticAccounts as readonly KitAddress[];
	if (keys[0] !== expected.payer) refuse("the machine's trading account is not paying for this");

	const byAccount = new Map(expected.tokens.map((token) => [token.account as string, token]));
	const moved = new Set<string>();
	const closed = new Set<string>();

	for (const instruction of message.instructions) {
		const program = keys[instruction.programAddressIndex];
		const data = instruction.data ?? new Uint8Array();
		const account = (position: number): string | undefined => {
			const index = instruction.accountIndices?.[position];
			return index === undefined ? undefined : keys[index];
		};

		if (program === COMPUTE_BUDGET) continue;

		if (program === ASSOCIATED_TOKEN_PROGRAM) {
			if (data[0] !== CREATE_IDEMPOTENT) refuse("a withdrawal only makes the owner's own accounts");
			if (account(0) !== expected.payer || account(2) !== expected.owner) {
				refuse("the withdrawal makes an account for somebody other than the owner");
			}
			continue;
		}

		if (program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM) {
			refuse("a token withdrawal calls a program it has no business in", { program });
		}

		const source = account(0) ?? "";
		const token = byAccount.get(source);
		if (!token) refuse("the withdrawal touches a token account that was not read", { source });
		if (program !== token.program) refuse("the withdrawal names the wrong token program");

		if (data[0] === TRANSFER_CHECKED && data.length === 10) {
			const amount = new DataView(data.buffer, data.byteOffset).getBigUint64(1, true);
			if (amount !== token.amount) {
				refuse("the withdrawal's amount is not the balance that was read", {
					read: token.amount.toString(),
					built: amount.toString(),
				});
			}
			const into = await tokenAccountFor({
				owner: expected.owner,
				mint: token.mint,
				tokenProgram: token.program,
			});
			if (account(1) !== token.mint || account(2) !== into || account(3) !== expected.from) {
				refuse("the withdrawal sends tokens somewhere other than the owner's own account");
			}
			if (moved.has(source)) refuse("the withdrawal moves the same account twice");
			moved.add(source);
			continue;
		}

		if (data[0] === CLOSE_ACCOUNT) {
			if (account(1) !== expected.owner || account(2) !== expected.from) {
				refuse("the withdrawal would close an account into somebody other than the owner");
			}
			closed.add(source);
			continue;
		}

		refuse("a token withdrawal moves tokens with a checked transfer and nothing else");
	}

	for (const token of expected.tokens) {
		const mustMove = token.amount > 0n && !isWrappedSol(token);
		if (mustMove && !moved.has(token.account)) {
			refuse("the withdrawal leaves a balance behind", { account: token.account });
		}
		if (!closed.has(token.account)) {
			refuse("the withdrawal leaves an account open", { account: token.account });
		}
	}

	return { signers, instructionCount: message.instructions.length };
}
