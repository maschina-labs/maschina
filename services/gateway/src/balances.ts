/**
 * What a machine holds, read from the chain when somebody asks.
 *
 * Nothing here is stored: a balance read an hour ago is a guess about now. Frozen tokens are left out,
 * as the budget leaves them out, because they exist but cannot be moved.
 */

import type { MachineBalances } from "@maschina/contracts";
import { type BalanceReader, parseAddress, readBalances } from "@maschina/solana";

async function holdings(reader: BalanceReader, address: string) {
	const read = await readBalances(reader, parseAddress(address));
	return {
		address: String(read.wallet),
		lamports: read.lamports.toString(),
		tokens: read.tokens
			.filter((token) => !token.frozen)
			.map((token) => ({
				mint: String(token.mint),
				amount: token.amount.toString(),
				decimals: token.decimals,
			})),
	};
}

export async function machineBalances(
	reader: BalanceReader,
	machine: { walletAddress: string; vaultAddress?: string | undefined },
): Promise<MachineBalances> {
	const [wallet, vault] = await Promise.all([
		holdings(reader, machine.walletAddress),
		machine.vaultAddress === undefined ? undefined : holdings(reader, machine.vaultAddress),
	]);
	return vault === undefined ? { wallet } : { wallet, vault };
}
