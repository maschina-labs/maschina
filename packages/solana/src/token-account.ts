/**
 * Where an owner's tokens of one kind live.
 *
 * On Solana a wallet does not hold tokens itself. Each token it holds sits in a separate account, and the
 * usual one is found rather than stored: it is derived from the owner, the token program and the mint,
 * so every tool in the ecosystem arrives at the same address without asking anybody.
 *
 * This matters most to a vault. A vault's policy names the one account it may pay into, which is the
 * owner's account for that token, and getting it wrong does not fail loudly: it produces a policy that
 * refuses every honest payment, or a transfer into an account the owner's wallet never looks at.
 */

import {
	getAddressEncoder,
	getProgramDerivedAddress,
	type Address as KitAddress,
} from "@solana/kit";
import { type Address, parseAddress } from "./address.ts";

/** The token program most tokens, USDC included, are held under. */
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
/** The newer token program. Same idea, different accounts. */
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/** The program that derives an owner's usual account for a token. */
export const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export type TokenAccountOf = {
	owner: string;
	mint: string;
	/** Which token program the mint belongs to. The classic one unless said otherwise. */
	tokenProgram?: string;
};

/** The owner's usual account for one token. Derived, so it exists as an address before it exists on chain. */
export async function tokenAccountFor(of: TokenAccountOf): Promise<Address> {
	const owner = parseAddress(of.owner);
	const mint = parseAddress(of.mint);
	const program = parseAddress(of.tokenProgram ?? TOKEN_PROGRAM);
	const encode = getAddressEncoder();

	const [account] = await getProgramDerivedAddress({
		programAddress: ASSOCIATED_TOKEN_PROGRAM as KitAddress,
		seeds: [encode.encode(owner), encode.encode(program), encode.encode(mint)],
	});
	return account;
}
