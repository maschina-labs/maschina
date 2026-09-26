/**
 * Moving SOL from one address to another.
 *
 * This is the simplest thing a machine wallet can be asked to do, and the one a wallet policy is
 * clearest about: a transfer has a recipient and an amount, both of which a policy can see. It is how a
 * machine returns funds to its owner, and it is the transaction used to prove a policy actually refuses
 * what it claims to refuse.
 *
 * Nothing here signs. It builds the bytes, and the signer is the only thing that can turn bytes into a
 * transaction anyone will accept.
 */

import { MaschinaError } from "@maschina/core";
import {
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
import {
	getTransferSolInstruction,
	getTransferSolInstructionDataDecoder,
	identifySystemInstruction,
	SystemInstruction,
} from "@solana-program/system";
import type { Address } from "./address.ts";
import { checkUnsignedSwap, type TransactionFacts } from "./swap-transaction.ts";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";

export type TransferRequest = {
	from: Address;
	to: Address;
	lamports: bigint;
	/** A recent blockhash, which is what gives a transaction its window to land in. */
	blockhash: string;
	lastValidBlockHeight: bigint;
};

/** An unsigned transfer, as wire bytes. */
export function buildTransfer(request: TransferRequest): Uint8Array {
	if (request.lamports <= 0n) {
		throw new MaschinaError("invalid_amount", "a transfer moves more than nothing");
	}
	if (request.from === request.to) {
		throw new MaschinaError("invalid_input", "a transfer needs two different addresses");
	}

	const message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(request.from as KitAddress, draft),
		(draft) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{
					blockhash: request.blockhash as Blockhash,
					lastValidBlockHeight: request.lastValidBlockHeight,
				},
				draft,
			),
		(draft) =>
			appendTransactionMessageInstruction(
				getTransferSolInstruction({
					source: { address: request.from as KitAddress } as never,
					destination: request.to as KitAddress,
					amount: request.lamports,
				}),
				draft,
			),
	);

	return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}

/** What a withdrawal claims to be, and what the bytes are checked against. */
export type WithdrawalCheck = {
	/** The machine's wallet: the only account that may sign, and the one that pays. */
	wallet: Address;
	/** The owner's wallet. A withdrawal that reaches anywhere else is the thing this prevents. */
	to: Address;
	lamports: bigint;
};

/**
 * Takes a withdrawal apart and refuses it unless it is exactly one transfer, of exactly this amount,
 * to exactly this address.
 *
 * This is the check that makes a withdrawal safe to sign. A machine wallet can be asked to move money,
 * so the only thing standing between "withdraw" and "drain" is proving that the bytes do what the
 * request says and nothing besides. Everything is refused by default: a second instruction, a different
 * destination, a different amount, a system instruction that is not a transfer, any program other than
 * the system program and the compute budget.
 *
 * The amount and destination are compared against what the caller stated rather than read out and
 * trusted, because a transfer the signer merely describes back to itself proves nothing.
 */
export function checkUnsignedWithdrawal(
	transaction: Uint8Array,
	check: WithdrawalCheck,
): TransactionFacts {
	// The shape checks a swap and a withdrawal share: unsigned, one signature, and that signature ours.
	const facts = checkUnsignedSwap(transaction, check.wallet);

	for (const program of facts.programs) {
		if (program !== SYSTEM_PROGRAM && program !== COMPUTE_BUDGET) {
			throw new MaschinaError("forbidden", "a withdrawal calls a program it has no business in", {
				details: { program },
			});
		}
	}

	const decoded = getTransactionDecoder().decode(transaction);
	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) {
		throw new MaschinaError(
			"invalid_input",
			"the withdrawal is in a format Maschina does not read",
		);
	}
	const accounts = message.staticAccounts as readonly KitAddress[];

	const transfers = message.instructions.filter(
		(instruction) => accounts[instruction.programAddressIndex] === SYSTEM_PROGRAM,
	);
	if (transfers.length !== 1) {
		throw new MaschinaError("forbidden", "a withdrawal is exactly one transfer and nothing else", {
			details: { transfers: transfers.length },
		});
	}

	const [only] = transfers;
	if (!only?.data) {
		throw new MaschinaError("invalid_input", "the withdrawal's instruction carries no data");
	}
	if (identifySystemInstruction(only.data as Uint8Array) !== SystemInstruction.TransferSol) {
		throw new MaschinaError("forbidden", "the withdrawal's instruction is not a transfer");
	}

	// The system transfer names its accounts in order: the source pays, the destination receives.
	const [sourceIndex, destinationIndex] = only.accountIndices ?? [];
	const source = sourceIndex === undefined ? undefined : accounts[sourceIndex];
	const destination = destinationIndex === undefined ? undefined : accounts[destinationIndex];
	if (source !== check.wallet) {
		throw new MaschinaError("forbidden", "the withdrawal moves money out of another wallet", {
			details: { source, wallet: check.wallet },
		});
	}
	if (destination !== check.to) {
		throw new MaschinaError("forbidden", "the withdrawal sends somewhere other than the owner", {
			details: { destination, owner: check.to },
		});
	}

	const { amount } = getTransferSolInstructionDataDecoder().decode(only.data as Uint8Array);
	if (amount !== check.lamports) {
		throw new MaschinaError("forbidden", "the withdrawal moves a different amount than it says", {
			details: { moves: amount.toString(), says: check.lamports.toString() },
		});
	}

	return facts;
}
