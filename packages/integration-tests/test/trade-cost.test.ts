/**
 * Reading what a real transaction cost, from mainnet.
 *
 * The transaction is a real Jupiter swap from slot 448492630. The expected numbers were worked out by
 * hand from its raw balances: the fee payer paid a 5,000 lamport fee, its native balance fell by 6,000
 * and its wrapped SOL rose by 10,088, so the trade itself left it 9,088 lamports up.
 */

import { balanceChangesOf, rpcTransactionReader, solanaRpc } from "@maschina/solana";
import { describe, expect, it } from "vitest";

const MAINNET = process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";
const SIGNATURE =
	"e3ZdGPDtXCvjys9u2roKwXsPfzYf2cXcaJk7oSzhhSJHdYJp7TdR6EooVqDpT763U9AKqCYkWkadDsY8ZRNdW7k";
/** The same signature with its last character changed: well formed, and never on chain. */
const NEVER_SEEN = `${SIGNATURE.slice(0, -1)}m`;
const PAYER = "C2wezAHikMgfvXJRqPuDvS7KZwLvKRr6xNR3U431GWas";
const SOL = "So11111111111111111111111111111111111111112";

describe("a landed transaction, read from mainnet", () => {
	it("gives the fee and the wallet's balance changes exactly", async () => {
		const reader = rpcTransactionReader(solanaRpc(MAINNET));
		const landed = await reader.transactionOf(SIGNATURE);

		expect(landed?.fee).toBe(5_000n);
		expect(landed && balanceChangesOf(landed, PAYER).get(SOL)).toBe(9_088n);
	});

	it("says nothing for a signature the chain has never seen", async () => {
		const reader = rpcTransactionReader(solanaRpc(MAINNET));
		expect(await reader.transactionOf(NEVER_SEEN)).toBeUndefined();
	});
});
