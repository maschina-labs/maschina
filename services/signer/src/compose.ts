/**
 * How the signer is put together, in the one order that is safe.
 *
 *   Maschina's rules  ->  hold the budget  ->  sign, send once, settle
 *
 * The rules come first so a trade that breaks them never holds money. The hold comes before the
 * signature so two trades can never both spend the last of a budget. Nothing reaches the chain without
 * passing both.
 */

import {
	type Confirmation,
	checkUnsignedSwap,
	confirmSignature,
	parseAddress,
	rpcConfirmationReader,
	rpcSender,
	rpcTransactionReader,
	type SolanaRpc,
	signatureOf,
	tradeCostOf,
} from "@maschina/solana";
import { chainSigner } from "./chain-signer.ts";
import type { WalletProvider } from "./provider/wallet-provider.ts";
import type { TradeSigner } from "./sign-route.ts";
import type { ChainAnswer } from "./submit-once.ts";
import { type BudgetLedger, withBudget } from "./with-budget.ts";
import { type RecordKeeper, withRules } from "./with-rules.ts";

/** Wraps the inner signer in the rules and the budget, rules outermost. */
export function layered(inner: TradeSigner, record: RecordKeeper & BudgetLedger): TradeSigner {
	return withRules(withBudget(inner, record), record);
}

/** The chain's answer about a signature, in the terms sending once uses. */
export function answerFrom(confirmation: Confirmation): ChainAnswer {
	switch (confirmation.outcome) {
		case "landed":
			return { outcome: "landed", signature: confirmation.signature, slot: confirmation.slot };
		case "failed":
			return { outcome: "failed", signature: confirmation.signature, reason: confirmation.error };
		case "expired":
			return { outcome: "expired", signature: confirmation.signature };
		case "unknown":
			return {
				outcome: "unknown",
				signature: confirmation.signature,
				because: confirmation.because,
			};
	}
}

/** Everything the record gives the signer. The database's version is `signerRecord`. */
export type SignerRecord = RecordKeeper &
	BudgetLedger &
	Parameters<typeof chainSigner>[0]["outcomes"] &
	Parameters<typeof chainSigner>[0]["submissions"] & {
		walletIdFor: Parameters<typeof chainSigner>[0]["walletIdFor"];
	};

/** The whole signer, from its real parts. */
export function tradeSigner(parts: {
	record: SignerRecord;
	provider: Pick<WalletProvider, "sign">;
	rpc: SolanaRpc;
}): TradeSigner {
	const { record, provider, rpc } = parts;
	const sender = rpcSender(rpc);
	const confirmations = rpcConfirmationReader(rpc);
	const transactions = rpcTransactionReader(rpc);

	const inner = chainSigner({
		checkShape: (transaction, wallet) => {
			checkUnsignedSwap(transaction, parseAddress(wallet));
		},
		walletIdFor: record.walletIdFor,
		provider,
		signatureOf,
		submissions: record,
		chain: {
			send: async (signed) => {
				await sender.send(signed);
			},
			confirm: async (_request, submission) =>
				answerFrom(
					await confirmSignature(confirmations, {
						signature: submission.signature,
						lastValidBlockHeight: submission.lastValidBlockHeight,
					}),
				),
			costOf: async (request, signature) => {
				const landed = await transactions.transactionOf(signature);
				if (!landed)
					throw new Error(`the chain has no transaction ${signature} to read a cost from`);
				return tradeCostOf(landed, request.wallet, request.trade);
			},
		},
		outcomes: record,
	});

	return layered(inner, record);
}
