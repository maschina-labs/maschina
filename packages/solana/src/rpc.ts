/**
 * Talking to a Solana RPC node.
 *
 * Everything above this file works against `AccountReader`, which is one method wide. That keeps the
 * chain replaceable in tests without mocking a whole RPC client, and keeps the Solana library inside
 * this package where the boundary check expects it.
 */

import { createSolanaRpc } from "@solana/kit";
import type { Address } from "./address.ts";
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
