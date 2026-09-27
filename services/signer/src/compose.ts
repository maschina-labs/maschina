/**
 * How the signer is put together, in the one order that is safe.
 *
 *   Maschina's rules  ->  hold the budget  ->  sign, send once, settle
 *
 * The rules come first so a trade that breaks them never holds money. The hold comes before the
 * signature so two trades can never both spend the last of a budget. Nothing reaches the chain without
 * passing both.
 */

import type { SweepRequest, WithdrawEverythingRequest, WithdrawRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import {
	type BlockhashReader,
	balanceOf,
	type Confirmation,
	checkFeeAgainstTransaction,
	checkSwapInstructions,
	checkUnsignedSwap,
	confirmSignature,
	parseAddress,
	readBalances,
	readMint,
	rpcAccountReader,
	rpcBalanceReader,
	rpcBlockhashReader,
	rpcConfirmationReader,
	rpcSender,
	rpcTransactionReader,
	type SolanaRpc,
	signatureOf,
	TOKEN_2022_PROGRAM,
	TOKEN_PROGRAM,
	tradeCostOf,
} from "@maschina/solana";
import { toMaschinaError, type WalletProvider } from "@maschina/wallet";
import { chainSigner } from "./chain-signer.ts";
import type { TradeSigner } from "./sign-route.ts";
import type { ChainAnswer } from "./submit-once.ts";
import { type SweepPorts, sweepProfit } from "./sweep.ts";
import { type HaltPorts, whileHalted } from "./while-halted.ts";
import { type BudgetLedger, withBudget } from "./with-budget.ts";
import { type RecordKeeper, withRules } from "./with-rules.ts";
import { type WithdrawPorts, withdrawFunds } from "./withdraw.ts";
import { type WithdrawEverythingPorts, withdrawEverything } from "./withdraw-everything.ts";

/**
 * Wraps the inner signer, outermost first: the halt, then the rules, then the budget.
 *
 * The halt goes outside everything because it is not a judgement about a trade. While one is in force
 * nothing is signed, whatever the rules or the budget would have said.
 */
export function layered(
	inner: TradeSigner,
	record: RecordKeeper & BudgetLedger & HaltPorts,
): TradeSigner {
	return whileHalted(withRules(withBudget(inner, record), record), record);
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

/**
 * Everything a transaction has to be before it is signed.
 *
 * Three things, and none believes anything it was told. It is a plain swap, signed and paid for by the
 * machine's own wallet. Its plumbing moves nothing out: no bare token transfer, no delegation, no SOL
 * anywhere but the wallet's own wrapped account, which is the one check the provider cannot make for a
 * wallet that trades (#667). And the fee it will actually pay for priority is inside the allowance. The
 * router's own answer was already held to the cap when the swap was built, but that check believes the
 * router's description of what it did. This one reads the bytes.
 */
export function shapeCheckFor(feeAllowance: bigint) {
	return async (transaction: Uint8Array, wallet: string): Promise<void> => {
		const machine = parseAddress(wallet);
		checkUnsignedSwap(transaction, machine);
		await checkSwapInstructions(transaction, machine);
		checkFeeAgainstTransaction(transaction, feeAllowance);
	};
}

/** Everything the record gives the signer. The database's version is `signerRecord`. */
export type SignerRecord = RecordKeeper &
	BudgetLedger &
	HaltPorts &
	Parameters<typeof chainSigner>[0]["outcomes"] &
	Parameters<typeof chainSigner>[0]["submissions"] & {
		walletIdFor: Parameters<typeof chainSigner>[0]["walletIdFor"];
	};

/** The whole signer, from its real parts. */
export function tradeSigner(parts: {
	record: SignerRecord;
	provider: Pick<WalletProvider, "sign">;
	rpc: SolanaRpc;
	/** The most a trade may pay to be included. The same number the budget holds back for it. */
	feeAllowance: bigint;
}): TradeSigner {
	const { record, provider, rpc } = parts;
	const sender = rpcSender(rpc);
	const confirmations = rpcConfirmationReader(rpc);
	const transactions = rpcTransactionReader(rpc);

	const inner = chainSigner({
		checkShape: shapeCheckFor(parts.feeAllowance),
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

/** What a sweep reads from and writes to the record. The database's version is in `main.ts`. */
export type SweepRecord = Pick<
	SweepPorts,
	"machineFor" | "floatOf" | "record" | "submissionFor" | "requestedFor"
>;

/**
 * The whole sweep, from its real parts.
 *
 * What the trading account holds is read from the chain here, and nowhere else, because it is the one
 * number the record cannot know. The mint's decimals come from the chain too, because a checked transfer
 * refuses the wrong number and a list is not the chain.
 */
export function sweeper(parts: {
	record: SweepRecord;
	provider: Pick<WalletProvider, "sign">;
	rpc: SolanaRpc;
}) {
	const { record, provider, rpc } = parts;
	const sender = rpcSender(rpc);
	const confirmations = rpcConfirmationReader(rpc);
	const transactions = rpcTransactionReader(rpc);
	const blockhashes: BlockhashReader = rpcBlockhashReader(rpc);
	const balances = rpcBalanceReader(rpc);
	const accounts = rpcAccountReader(rpc);

	const ports: SweepPorts = {
		...record,
		holdingOf: async (wallet, mint) => balanceOf(await readBalances(balances, wallet), mint),
		decimalsOf: async (mint) => (await readMint(accounts, mint)).decimals,
		latestBlockhash: () => blockhashes.latest(),
		// The trading account signs: it is where the profit is, and the vault only ever receives.
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

	return { sweep: (request: SweepRequest) => sweepProfit(ports, request) };
}

/** What taking everything out reads from and writes to the record. */
export type EverythingRecord = Pick<
	WithdrawEverythingPorts,
	"machineFor" | "record" | "submissionFor"
>;

/**
 * Taking everything out of a machine, from its real parts.
 *
 * Balances come from the chain here, empty token accounts included, because closing an empty account
 * returns its rent and that is the owner's money too. The SOL goes last, through the plain withdrawal
 * that has already moved money on chain.
 */
export function everythingWithdrawer(parts: {
	record: EverythingRecord;
	provider: Pick<WalletProvider, "sign">;
	rpc: SolanaRpc;
	withdrawSol: (request: WithdrawRequest) => ReturnType<WithdrawEverythingPorts["withdrawSol"]>;
}) {
	const { record, provider, rpc, withdrawSol } = parts;
	const sender = rpcSender(rpc);
	const confirmations = rpcConfirmationReader(rpc);
	const transactions = rpcTransactionReader(rpc);
	const blockhashes: BlockhashReader = rpcBlockhashReader(rpc);
	const balances = rpcBalanceReader(rpc);

	const ports: WithdrawEverythingPorts = {
		...record,
		tokensOf: async (account) =>
			(await readBalances(balances, account)).tokens.map((token) => ({
				account: token.account,
				mint: token.mint,
				amount: token.amount,
				decimals: token.decimals,
				program: token.program === "token" ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM,
				frozen: token.frozen,
			})),
		lamportsOf: async (account) => (await readBalances(balances, account)).lamports,
		latestBlockhash: () => blockhashes.latest(),
		sign: async (walletId, transaction, account) => {
			const signed = await provider.sign(walletId, transaction, account);
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
		newId: () => newId<"withdrawal">(),
		withdrawSol,
	};

	return {
		withdrawEverything: (request: WithdrawEverythingRequest) => withdrawEverything(ports, request),
	};
}
