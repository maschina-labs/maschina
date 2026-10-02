/**
 * Funding a machine: the owner's dollars and a little SOL for its fees, into its wallet, in one approval.
 *
 * The owner's wallet signs this, not Maschina: it is the owner moving their own money. Everything else
 * about a machine's money goes the other way and only ever back to the owner. This one builds the bytes
 * and nothing more; the owner's wallet shows what it does before they approve it.
 *
 * Three instructions at most: make the machine's account for the token if it has none (paid by the
 * owner), move the tokens into it, and send the SOL.
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
import { getTransferSolInstruction } from "@solana-program/system";
import type { Address } from "./address.ts";
import { ASSOCIATED_TOKEN_PROGRAM, tokenAccountFor } from "./token-account.ts";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TRANSFER_CHECKED = 12;
const CREATE_IDEMPOTENT = 1;

export type FundingRequest = {
	owner: Address;
	machine: Address;
	/** The token the machine trades with, and how much of it to send. Absent to send only SOL. */
	token?: { mint: Address; amount: bigint; decimals: number; program: string } | undefined;
	/** SOL for the machine's own network fees, in lamports. */
	lamports: bigint;
	blockhash: string;
	lastValidBlockHeight: bigint;
};

/** An unsigned funding transaction, as wire bytes, for the owner's wallet to approve. */
export async function buildFunding(request: FundingRequest): Promise<Uint8Array> {
	if (request.machine === request.owner) {
		throw new MaschinaError("invalid_input", "a machine is funded from the owner's own wallet");
	}
	const tokens = request.token && request.token.amount > 0n ? request.token : undefined;
	if (!tokens && request.lamports <= 0n) {
		throw new MaschinaError("invalid_amount", "funding sends something, not nothing");
	}

	type Draft = Parameters<typeof appendTransactionMessageInstruction>[1];
	type Compilable = Parameters<typeof compileTransaction>[0];
	const owner = request.owner as KitAddress;
	const machine = request.machine as KitAddress;

	let message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(owner, draft),
		(draft) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{
					blockhash: request.blockhash as Blockhash,
					lastValidBlockHeight: request.lastValidBlockHeight,
				},
				draft,
			),
	) as Draft;

	if (tokens) {
		const program = tokens.program as KitAddress;
		const mint = tokens.mint as KitAddress;
		const from = (await tokenAccountFor({
			owner: request.owner,
			mint: tokens.mint,
			tokenProgram: tokens.program,
		})) as KitAddress;
		const into = (await tokenAccountFor({
			owner: request.machine,
			mint: tokens.mint,
			tokenProgram: tokens.program,
		})) as KitAddress;

		message = appendTransactionMessageInstruction(
			{
				programAddress: ASSOCIATED_TOKEN_PROGRAM as KitAddress,
				accounts: [
					{ address: owner, role: AccountRole.WRITABLE_SIGNER },
					{ address: into, role: AccountRole.WRITABLE },
					{ address: machine, role: AccountRole.READONLY },
					{ address: mint, role: AccountRole.READONLY },
					{ address: SYSTEM_PROGRAM as KitAddress, role: AccountRole.READONLY },
					{ address: program, role: AccountRole.READONLY },
				],
				data: new Uint8Array([CREATE_IDEMPOTENT]),
			},
			message,
		) as Draft;

		const data = new Uint8Array(10);
		data[0] = TRANSFER_CHECKED;
		new DataView(data.buffer).setBigUint64(1, tokens.amount, true);
		data[9] = tokens.decimals;
		message = appendTransactionMessageInstruction(
			{
				programAddress: program,
				accounts: [
					{ address: from, role: AccountRole.WRITABLE },
					{ address: mint, role: AccountRole.READONLY },
					{ address: into, role: AccountRole.WRITABLE },
					{ address: owner, role: AccountRole.WRITABLE_SIGNER },
				],
				data,
			},
			message,
		) as Draft;
	}

	if (request.lamports > 0n) {
		message = appendTransactionMessageInstruction(
			getTransferSolInstruction({
				source: { address: owner } as never,
				destination: machine,
				amount: request.lamports,
			}),
			message,
		) as Draft;
	}

	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message as Compilable)));
}

/** What a funding transaction does, read back from its bytes, for checking it before it is signed. */
export type FundingFacts = {
	payer: string;
	token?: { from: string; to: string; amount: bigint };
	sol?: { to: string; lamports: bigint };
	programs: string[];
};

export async function readFunding(bytes: Uint8Array): Promise<FundingFacts> {
	const decoded = getTransactionDecoder().decode(bytes);
	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) {
		throw new MaschinaError("invalid_input", "the funding is in a format Maschina does not read");
	}
	const keys = message.staticAccounts as readonly string[];
	const facts: FundingFacts = { payer: keys[0] ?? "", programs: [] };
	for (const instruction of message.instructions) {
		const program = keys[instruction.programAddressIndex] ?? "";
		facts.programs.push(program);
		const data = instruction.data ?? new Uint8Array();
		const account = (position: number) => keys[instruction.accountIndices?.[position] ?? -1] ?? "";
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		if (program !== SYSTEM_PROGRAM && program !== ASSOCIATED_TOKEN_PROGRAM && data[0] === 12) {
			facts.token = { from: account(0), to: account(2), amount: view.getBigUint64(1, true) };
		}
		if (program === SYSTEM_PROGRAM && data.length === 12) {
			facts.sol = { to: account(1), lamports: view.getBigUint64(4, true) };
		}
	}
	return facts;
}
