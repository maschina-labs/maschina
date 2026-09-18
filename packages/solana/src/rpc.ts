/**
 * Talking to a Solana RPC node.
 *
 * Everything above this file works against `AccountReader`, which is one method wide. That keeps the
 * chain replaceable in tests without mocking a whole RPC client, and keeps the Solana library inside
 * this package where the boundary check expects it.
 */

import { createSolanaRpc } from "@solana/kit";
import type { Address } from "./address.ts";
import type { BalanceReader, FetchedTokenAccount } from "./balances.ts";
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
