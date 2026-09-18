/**
 * What a machine's wallet actually holds.
 *
 * Every amount here is a whole number of the token's smallest unit. An RPC node also returns a
 * convenient decimal for each balance, and that number is thrown away on purpose: it is a floating point
 * value, so 0.1 USDC is not exactly 0.1, and a budget built from it drifts. The only numbers used are
 * the integer string and the token's decimals.
 *
 * Not every lamport in a wallet can be spent. An account has to keep a rent-exempt minimum or the chain
 * deletes it, and each token account holds its own reserve, so `spendableLamports` is what a budget is
 * allowed to look at.
 */

import { type BaseUnits, baseUnitsOf, MaschinaError } from "@maschina/core";
import type { Address } from "./address.ts";
import { parseAddress } from "./address.ts";
import type { FetchedAccount, TokenProgram } from "./mint.ts";

/** One token account belonging to a wallet. A wallet has one per token it has ever held. */
export type TokenBalance = {
	/** The token account itself, which is not the wallet's address. */
	account: Address;
	mint: Address;
	owner: Address;
	amount: BaseUnits;
	decimals: number;
	program: TokenProgram;
	/** True when the token's freeze authority has frozen this account. Frozen means it cannot be sold. */
	frozen: boolean;
};

export type WalletBalances = {
	wallet: Address;
	lamports: BaseUnits;
	tokens: TokenBalance[];
};

/** A token account as an RPC returns it, with the account's own address alongside. */
export type FetchedTokenAccount = FetchedAccount & { address: string };

export type BalanceReader = {
	/** Native SOL, in lamports. */
	lamportsOf(wallet: Address): Promise<bigint>;
	/** Every token account the wallet owns, across both token programs. */
	tokenAccountsOf(wallet: Address): Promise<FetchedTokenAccount[]>;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const TOKEN_PROGRAMS: Record<string, TokenProgram> = {
	TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "token",
	TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "token-2022",
};

/**
 * Turns a fetched token account into a balance, checking every field.
 *
 * The amount and the decimals have to come from the same account, or a balance means nothing.
 */
export function parseTokenAccount(account: FetchedTokenAccount): TokenBalance {
	const program = TOKEN_PROGRAMS[account.owner];
	if (!program) {
		throw new MaschinaError("invalid_input", "this is not a token account", {
			details: { account: account.address, owner: account.owner },
		});
	}

	const parsed = asRecord(asRecord(account.data)?.["parsed"]);
	if (parsed?.["type"] !== "account") {
		throw new MaschinaError("invalid_input", "this account does not hold tokens", {
			details: { account: account.address },
		});
	}

	const info = asRecord(parsed["info"]);
	const balance = asRecord(info?.["tokenAmount"]);
	if (!info || !balance) {
		throw new MaschinaError("invalid_input", "the token account has no balance", {
			details: { account: account.address },
		});
	}

	const amount = balance["amount"];
	if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
		throw new MaschinaError("invalid_input", "the balance is not a whole number", {
			details: { account: account.address, amount },
		});
	}

	const decimals = balance["decimals"];
	if (
		typeof decimals !== "number" ||
		!Number.isInteger(decimals) ||
		decimals < 0 ||
		decimals > 18
	) {
		throw new MaschinaError("invalid_input", "the balance has impossible decimals", {
			details: { account: account.address, decimals },
		});
	}

	const mint = info["mint"];
	const owner = info["owner"];
	if (typeof mint !== "string" || typeof owner !== "string") {
		throw new MaschinaError("invalid_input", "the token account is missing its mint or owner", {
			details: { account: account.address },
		});
	}

	return {
		account: parseAddress(account.address),
		mint: parseAddress(mint),
		owner: parseAddress(owner),
		amount: baseUnitsOf(BigInt(amount)),
		decimals,
		program,
		frozen: info["state"] === "frozen",
	};
}

/** Everything a wallet holds, read in one go so the numbers belong to the same moment. */
export async function readBalances(
	reader: BalanceReader,
	wallet: Address,
): Promise<WalletBalances> {
	const [lamports, accounts] = await Promise.all([
		reader.lamportsOf(wallet),
		reader.tokenAccountsOf(wallet),
	]);

	const tokens = accounts.map(parseTokenAccount);
	for (const token of tokens) {
		// A node answering with somebody else's token account would quietly inflate a budget.
		if (token.owner !== wallet) {
			throw new MaschinaError("invalid_input", "this token account belongs to another wallet", {
				details: { account: token.account, owner: token.owner, wallet },
			});
		}
	}

	return { wallet, lamports: baseUnitsOf(lamports), tokens };
}

/**
 * How much of one token a wallet holds, adding up every account for that mint.
 *
 * A wallet can hold the same token in more than one account, and a frozen account is counted out: those
 * tokens exist but cannot be moved, so treating them as balance would let a machine plan a trade it can
 * never make.
 */
export function balanceOf(balances: WalletBalances, mint: Address): BaseUnits {
	let total = 0n;
	for (const token of balances.tokens) {
		if (token.mint === mint && !token.frozen) total += token.amount;
	}
	return baseUnitsOf(total);
}

/** Every mint the wallet holds something of, frozen or not. */
export const mintsHeld = (balances: WalletBalances): Address[] => [
	...new Set(balances.tokens.filter((token) => token.amount > 0n).map((token) => token.mint)),
];

/**
 * The rent-exempt minimum for a plain wallet account, in lamports.
 *
 * Solana charges rent unless an account holds a minimum for its size. A wallet is zero bytes of data,
 * and this is that minimum today. It is a floor, not a fee: spend below it and the account is closed.
 */
export const WALLET_RENT_EXEMPT_LAMPORTS = 890_880n;

/**
 * SOL a machine may actually plan to spend: the balance, less the rent minimum, less a reserve kept
 * back for transaction fees. Never negative, because a wallet that cannot pay a fee has nothing to spend.
 */
export function spendableLamports(
	balances: WalletBalances,
	feeReserveLamports: bigint = 0n,
): BaseUnits {
	if (feeReserveLamports < 0n) {
		throw new MaschinaError("invalid_amount", "a fee reserve cannot be negative");
	}
	const keep = WALLET_RENT_EXEMPT_LAMPORTS + feeReserveLamports;
	const spendable = balances.lamports - keep;
	return baseUnitsOf(spendable > 0n ? spendable : 0n);
}
