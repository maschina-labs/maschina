/**
 * Reading the blockhash a transaction was actually built against.
 *
 * A transaction's window to land is decided by the blockhash inside it, and by nothing else. Whoever
 * built the transaction can describe that window however they like, and a node that proposes a trade
 * does exactly that: it hands over both the bytes and a number saying when they expire. Believing the
 * number is how a transaction that is still perfectly able to land gets written off as dead, and the
 * money held for it handed back while it is in flight.
 *
 * So the number is not believed. The blockhash is read out of the bytes, which are the same bytes the
 * wallet signs and the chain enforces, and the chain is asked whether it is still good.
 */

import { MaschinaError } from "@maschina/core";
import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";

/**
 * The blockhash inside a transaction.
 *
 * Throws when the bytes are not a transaction this can read, because a transaction whose expiry cannot
 * be established is one nothing should go on to declare expired.
 */
export function blockhashOf(transaction: Uint8Array): string {
	let lifetimeToken: string;
	try {
		const decoded = getTransactionDecoder().decode(transaction);
		lifetimeToken = getCompiledTransactionMessageDecoder().decode(
			decoded.messageBytes,
		).lifetimeToken;
	} catch (cause) {
		throw new MaschinaError("invalid_input", "the transaction's blockhash could not be read", {
			cause,
		});
	}

	if (!lifetimeToken) {
		throw new MaschinaError(
			"invalid_input",
			"the transaction names no blockhash to expire against",
		);
	}

	return lifetimeToken;
}
