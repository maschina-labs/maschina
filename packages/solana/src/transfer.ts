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
	getTransactionEncoder,
	type Address as KitAddress,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import type { Address } from "./address.ts";

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
