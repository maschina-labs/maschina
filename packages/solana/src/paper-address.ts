/**
 * The address of a paper machine's wallet.
 *
 * A machine on paper never signs anything, so it has no business holding a key. It still needs an
 * address: the record, the app and the public page all show one, and the column is unique. So one is
 * generated here and the private key is dropped on the spot, never returned, never written anywhere.
 *
 * That is not a trick to look real. It is the truest thing that can be said about a paper wallet: it
 * cannot sign, because the key that could does not exist any more. Nothing has to refuse it.
 */

import { generateKeyPair, getAddressFromPublicKey } from "@solana/kit";

export async function newPaperAddress(): Promise<string> {
	// Only the public half is read out of this. The private half is never touched again and goes out
	// of scope as soon as this returns.
	const keys = await generateKeyPair();
	return getAddressFromPublicKey(keys.publicKey);
}
