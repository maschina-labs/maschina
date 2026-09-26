/**
 * How the signer is put together, in the one order that is safe.
 *
 *   Maschina's rules  ->  hold the budget  ->  sign, send once, settle
 *
 * The rules come first so a trade that breaks them never holds money. The hold comes before the
 * signature so two trades can never both spend the last of a budget. Nothing reaches the chain without
 * passing both.
 */

import type { WithdrawRequest } from "@maschina/contracts";
import {
	type BlockhashReader,
	type Confirmation,
	checkUnsignedSwap,
	confirmSignature,
	parseAddress,
	rpcBlockhashReader,
	rpcConfirmationReader,
	rpcSender,
	rpcTransactionReader,
	type SolanaRpc,
	signatureOf,
	tradeCostOf,
} from "@maschina/solana";
import { toMaschinaError, type WalletProvider } from "@maschina/wallet";
import { chainSigner } from "./chain-signer.ts";
import type { TradeSigner } from "./sign-route.ts";
import type { ChainAnswer } from "./submit-once.ts";
import { type BudgetLedger, withBudget } from "./with-budget.ts";
import { type RecordKeeper, withRules } from "./with-rules.ts";
import { type WithdrawPorts, withdrawFunds } from "./withdraw.ts";

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

/** Everything the record gives a withdrawal. The database's version is in `@maschina/db`. */
export type WithdrawalRecord = {
	machineFor: WithdrawPorts["machineFor"];
	record: WithdrawPorts["record"];
	submissionFor: WithdrawPorts["submissionFor"];
};

/**
 * Returning a machine's funds, from its real parts.
 *
 * Built from the same pieces a trade uses, on purpose: the same sender, the same confirmation reader,
 * the same at-most-once submission. What differs is what is judged and what is recorded, and neither of
 * those belongs to a trade.
 */
export function withdrawer(parts: {
	record: WithdrawalRecord;
	provider: Pick<WalletProvider, "sign">;
	rpc: SolanaRpc;
}) {
	const { record, provider, rpc } = parts;
	const sender = rpcSender(rpc);
	const confirmations = rpcConfirmationReader(rpc);
	const transactions = rpcTransactionReader(rpc);
	const blockhashes: BlockhashReader = rpcBlockhashReader(rpc);

	const ports: WithdrawPorts = {
		machineFor: record.machineFor,
		record: record.record,
		submissionFor: record.submissionFor,
		latestBlockhash: () => blockhashes.latest(),
		sign: async (walletId, transaction) => {
			const signed = await provider.sign(walletId, transaction);
			if (signed.ok) return signed.value;
			throw toMaschinaError(signed.error);
		},
		signatureOf,
		send: async (signed) => {
			await sender.send(signed);
		},
		confirm: async (submission) =>
			answerFrom(
				await confirmSignature(confirmations, {
					signature: submission.signature,
					lastValidBlockHeight: submission.lastValidBlockHeight,
				}),
			),
		costOf: async (signature) => {
			const landed = await transactions.transactionOf(signature);
			if (!landed) throw new Error(`the chain has no transaction ${signature} to read a cost from`);
			return landed.fee;
		},
	};

	return { withdraw: (request: WithdrawRequest) => withdrawFunds(ports, request) };
}
