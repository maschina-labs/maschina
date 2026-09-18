/**
 * The tokens a machine is allowed to touch.
 *
 * The first machine kinds trade a short, fixed list. That is not a limitation to remove later: an
 * allowed list is the cheapest protection there is against a machine buying a token that cannot be sold
 * again, and against a mistyped mint sending money somewhere final. Anything not on the list is refused
 * before a quote is even asked for.
 *
 * The decimals written here are a claim, not the truth. The truth is on the chain, and
 * `checkMintMatches` is how the two are held together: a wrong entry fails loudly instead of trading a
 * thousand times too much.
 */

import { MaschinaError } from "@maschina/core";
import { type Address, parseAddress } from "./address.ts";
import type { Cluster } from "./cluster.ts";
import type { MintDetails } from "./mint.ts";

export type ApprovedToken = {
	mint: Address;
	symbol: string;
	name: string;
	decimals: number;
};

const token = (mint: string, symbol: string, name: string, decimals: number): ApprovedToken => ({
	mint: parseAddress(mint),
	symbol,
	name,
	decimals,
});

/** Wrapped SOL, which is what a swap actually trades. The same mint exists on every cluster. */
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

const MAINNET: readonly ApprovedToken[] = [
	token(WRAPPED_SOL, "SOL", "Wrapped SOL", 9),
	token("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", "USD Coin", 6),
	token("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "USDT", "Tether USD", 6),
];

/**
 * Devnet has two dollars worth knowing about: Circle's, which a faucet hands out, and Orca's, which is
 * the one with liquidity in the devnet pools a machine can actually trade against.
 */
const DEVNET: readonly ApprovedToken[] = [
	token(WRAPPED_SOL, "SOL", "Wrapped SOL", 9),
	token("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k", "devUSDC", "Devnet USDC (Orca)", 6),
	token("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", "USDC", "USD Coin (devnet)", 6),
];

/** A local validator forks mainnet, so it trades mainnet's tokens. */
const APPROVED: Record<Cluster, readonly ApprovedToken[]> = {
	mainnet: MAINNET,
	devnet: DEVNET,
	localnet: MAINNET,
};

export const approvedTokens = (cluster: Cluster): readonly ApprovedToken[] => APPROVED[cluster];

/** The approved token for a mint, or nothing when it is not approved. */
export function findApprovedToken(cluster: Cluster, mint: string): ApprovedToken | undefined {
	return approvedTokens(cluster).find((entry) => entry.mint === mint);
}

/** The approved token for a symbol, matched exactly, because "usdc" and "USDC" are not the same token. */
export function findApprovedSymbol(cluster: Cluster, symbol: string): ApprovedToken | undefined {
	return approvedTokens(cluster).find((entry) => entry.symbol === symbol);
}

/** The approved token for a mint, refusing anything else. Use this on the path to a trade. */
export function requireApprovedToken(cluster: Cluster, mint: string): ApprovedToken {
	const approved = findApprovedToken(cluster, mint);
	if (!approved) {
		throw new MaschinaError("forbidden", "this token is not approved for trading", {
			details: { mint, cluster, approved: approvedTokens(cluster).map((entry) => entry.symbol) },
		});
	}
	return approved;
}

/**
 * Holds the list against the chain. Called wherever a list entry is about to decide an amount, so a
 * wrong entry stops the machine instead of scaling every trade by a factor of a thousand.
 */
export function checkMintMatches(approved: ApprovedToken, details: MintDetails): void {
	if (details.mint !== approved.mint) {
		throw new MaschinaError("invalid_input", "these are details for a different mint", {
			details: { expected: approved.mint, got: details.mint },
		});
	}
	if (details.decimals !== approved.decimals) {
		throw new MaschinaError(
			"invalid_input",
			`${approved.symbol} has ${details.decimals} decimals on chain, the list says ${approved.decimals}`,
			{ details: { mint: approved.mint } },
		);
	}
}
