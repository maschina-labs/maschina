/**
 * Talking to a Solana RPC node.
 *
 * Everything above this file works against `AccountReader`, which is one method wide. That keeps the
 * chain replaceable in tests without mocking a whole RPC client, and keeps the Solana library inside
 * this package where the boundary check expects it.
 */

import { createSolanaRpc, type Signature } from "@solana/kit";
import type { Address } from "./address.ts";
import type { BalanceReader, FetchedTokenAccount } from "./balances.ts";
import type { Commitment, ConfirmationReader, SignatureStatus } from "./confirm.ts";
import type { AccountReader, FetchedAccount } from "./mint.ts";

export type SolanaRpc = ReturnType<typeof createSolanaRpc>;

/** Reads accounts through an RPC node, parsed by the node so this package does not decode layouts. */
export function rpcAccountReader(rpc: SolanaRpc): AccountReader {
	return {
		async read(address: Address): Promise<FetchedAccount | undefined> {
			const { value } = await rpc.getAccountInfo(address, { encoding: "jsonParsed" }).send();
			if (!value) return undefined;
			return { owner: value.owner, data: value.data };
		},
	};
}

/** An RPC client for a URL. Kept here so nothing outside this package constructs one. */
export const solanaRpc = (url: string): SolanaRpc => createSolanaRpc(url);

/** The two token programs a wallet can hold accounts in. Both are asked, or balances go missing. */
const TOKEN_PROGRAM_IDS = [
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
	"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
] as const;

/** Reads balances through an RPC node. */
export function rpcBalanceReader(rpc: SolanaRpc): BalanceReader {
	return {
		async lamportsOf(wallet: Address): Promise<bigint> {
			const { value } = await rpc.getBalance(wallet).send();
			return BigInt(value);
		},

		async tokenAccountsOf(wallet: Address): Promise<FetchedTokenAccount[]> {
			const perProgram = await Promise.all(
				TOKEN_PROGRAM_IDS.map(async (programId) => {
					const { value } = await rpc
						.getTokenAccountsByOwner(
							wallet,
							{ programId: programId as unknown as Address },
							{ encoding: "jsonParsed" },
						)
						.send();
					return value.map((entry) => ({
						address: entry.pubkey,
						owner: entry.account.owner,
						data: entry.account.data,
					}));
				}),
			);
			return perProgram.flat();
		},
	};
}

/** Reads signature statuses and block height through an RPC node. */
export function rpcConfirmationReader(rpc: SolanaRpc): ConfirmationReader {
	return {
		async statusOf(
			signature: string,
			searchHistory: boolean,
		): Promise<SignatureStatus | undefined> {
			const { value } = await rpc
				.getSignatureStatuses([signature as Signature], {
					searchTransactionHistory: searchHistory,
				})
				.send();

			const [status] = value;
			if (!status) return undefined;

			return {
				slot: BigInt(status.slot),
				commitment: (status.confirmationStatus ?? "processed") as Commitment,
				...(status.err ? { error: JSON.stringify(status.err) } : {}),
			};
		},

		async blockHeight(): Promise<bigint> {
			return BigInt(await rpc.getBlockHeight().send());
		},
	};
}

/** Sends a signed transaction, and says what the chain called it. */
export type TransactionSender = {
	send(signedTransaction: Uint8Array): Promise<string>;
};

/**
 * Sends through an RPC node.
 *
 * Preflight checks are left on: they cost a moment and catch a transaction that could never succeed
 * before it costs a fee. `maxRetries` is zero because retrying is a decision the run loop makes with
 * the record in front of it, not something a client library should do quietly.
 */
export function rpcSender(rpc: SolanaRpc): TransactionSender {
	return {
		async send(signedTransaction: Uint8Array): Promise<string> {
			const encoded = Buffer.from(signedTransaction).toString("base64");
			return rpc
				.sendTransaction(encoded as Parameters<SolanaRpc["sendTransaction"]>[0], {
					encoding: "base64",
					maxRetries: 0n,
				})
				.send();
		},
	};
}
