/**
 * Signing in with a wallet.
 *
 * Two steps, because a wallet signs a sentence rather than a transaction. The server offers the exact
 * sentence, and the wallet returns it signed. Nothing here carries a key, and nothing here approves a
 * transfer.
 */

import { z } from "zod";

const address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "not an address");

export const SignInChallengeRequest = z
	.strictObject({ walletAddress: address })
	.meta({ id: "SignInChallengeRequest" });
export type SignInChallengeRequest = z.infer<typeof SignInChallengeRequest>;

export const SignInChallenge = z
	.strictObject({
		/** The exact text to sign. Signing anything else proves nothing. */
		message: z.string(),
		nonce: z.string(),
		expiresAt: z.string(),
	})
	.meta({ id: "SignInChallenge" });
export type SignInChallenge = z.infer<typeof SignInChallenge>;

export const SignInRequest = z
	.strictObject({
		walletAddress: address,
		message: z.string().min(1).max(2000),
		/** Base58, as every Solana wallet returns it. */
		signature: z.string().min(64).max(128),
	})
	.meta({ id: "SignInRequest" });
export type SignInRequest = z.infer<typeof SignInRequest>;

/**
 * Who is signed in. A person who came in with an email, Google, GitHub or their company has an email and no
 * wallet until they link one; a wallet that signed in has a wallet and, until it links one, no email.
 */
export const SignedInOwner = z
	.strictObject({
		ownerId: z.string(),
		walletAddress: address.nullable(),
		email: z.string().nullable(),
	})
	.meta({ id: "SignedInOwner" });
export type SignedInOwner = z.infer<typeof SignedInOwner>;
