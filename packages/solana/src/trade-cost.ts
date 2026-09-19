/**
 * What a landed trade actually cost.
 *
 * A quote says what a trade should do. The chain says what it did. Budgets are settled from the chain,
 * so this reads the transaction back and works out, for the machine's wallet only: what it spent, what
 * it received, and the fee.
 *
 * SOL needs care. A swap usually wraps SOL into a token account, trades it, and unwraps what is left,
 * all inside one transaction. So the wallet's native balance and its wrapped SOL are counted together
 * as one amount of SOL, and the fee is taken out, because it is reported on its own.
 */

import { MaschinaError } from "@maschina/core";
import type { Signature } from "@solana/kit";
import type { SolanaRpc } from "./rpc.ts";

export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

export type ChainTokenBalance = { mint: string; owner?: string | undefined; amount: bigint };

/** A transaction as the chain recorded it, reduced to what cost needs. */
export type LandedTransaction = {
	fee: bigint;
	/** Why it failed on chain, when it did. A failed transaction still pays its fee. */
	failed?: string;
	accountKeys: string[];
	preBalances: bigint[];
	postBalances: bigint[];
	preTokenBalances: ChainTokenBalance[];
	postTokenBalances: ChainTokenBalance[];
};

export type TradeCost = {
	inputAmount: bigint;
	outputAmount: bigint;
	feeLamports: bigint;
};

export type TransactionReader = {
	/** The transaction, or nothing when the chain has no record of the signature. */
	transactionOf(signature: string): Promise<LandedTransaction | undefined>;
};

const sumFor = (balances: ChainTokenBalance[], wallet: string) => {
	const totals = new Map<string, bigint>();
	for (const balance of balances) {
		if (balance.owner !== wallet) continue;
		totals.set(balance.mint, (totals.get(balance.mint) ?? 0n) + balance.amount);
	}
	return totals;
};

/** How much of each mint the wallet gained (positive) or lost (negative), with the fee left out. */
export function balanceChangesOf(
	transaction: LandedTransaction,
	wallet: string,
): Map<string, bigint> {
	const index = transaction.accountKeys.indexOf(wallet);
	if (index < 0) {
		throw new MaschinaError("invalid_input", "the wallet is not in this transaction", {
			details: { wallet },
		});
	}

	const before = sumFor(transaction.preTokenBalances, wallet);
	const after = sumFor(transaction.postTokenBalances, wallet);
	const changes = new Map<string, bigint>();
	for (const mint of new Set([...before.keys(), ...after.keys()])) {
		changes.set(mint, (after.get(mint) ?? 0n) - (before.get(mint) ?? 0n));
	}

	// The fee payer's native balance fell by the fee as well as by the trade. Add it back, so what is
	// left is the trade alone. Only the fee payer (the first account) pays it.
	const native =
		(transaction.postBalances[index] ?? 0n) -
		(transaction.preBalances[index] ?? 0n) +
		(index === 0 ? transaction.fee : 0n);
	changes.set(WRAPPED_SOL, (changes.get(WRAPPED_SOL) ?? 0n) + native);
	return changes;
}

/** What one trade cost the wallet, read from the chain. */
export function tradeCostOf(
	transaction: LandedTransaction,
	wallet: string,
	trade: { inputMint: string; outputMint: string },
): TradeCost {
	if (transaction.failed !== undefined) {
		throw new MaschinaError("invalid_input", "the transaction failed on chain", {
			details: { reason: transaction.failed },
		});
	}
	const changes = balanceChangesOf(transaction, wallet);
	const spent = -(changes.get(trade.inputMint) ?? 0n);
	const received = changes.get(trade.outputMint) ?? 0n;
	return {
		inputAmount: spent > 0n ? spent : 0n,
		outputAmount: received > 0n ? received : 0n,
		feeLamports: transaction.fee,
	};
}

type ParsedBalance = { mint: string; owner?: string; uiTokenAmount: { amount: string } };
const toBalance = (balance: ParsedBalance): ChainTokenBalance => ({
	mint: balance.mint,
	owner: balance.owner,
	amount: BigInt(balance.uiTokenAmount.amount),
});

/** Reads landed transactions through an RPC node. */
export function rpcTransactionReader(rpc: SolanaRpc): TransactionReader {
	return {
		async transactionOf(signature) {
			const found = await rpc
				.getTransaction(signature as Signature, {
					encoding: "jsonParsed",
					maxSupportedTransactionVersion: 0,
					commitment: "confirmed",
				})
				.send();
			if (!found?.meta) return undefined;
			const { meta } = found;
			return {
				fee: BigInt(meta.fee),
				...(meta.err
					? {
							failed: JSON.stringify(meta.err, (_, v) =>
								typeof v === "bigint" ? v.toString() : v,
							),
						}
					: {}),
				accountKeys: found.transaction.message.accountKeys.map((key) => String(key.pubkey)),
				preBalances: meta.preBalances.map(BigInt),
				postBalances: meta.postBalances.map(BigInt),
				preTokenBalances: ((meta.preTokenBalances ?? []) as unknown as ParsedBalance[]).map(
					toBalance,
				),
				postTokenBalances: ((meta.postTokenBalances ?? []) as unknown as ParsedBalance[]).map(
					toBalance,
				),
			};
		},
	};
}
