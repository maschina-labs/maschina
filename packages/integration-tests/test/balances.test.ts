/**
 * Balances read from devnet, checked against the chain answering a different way.
 *
 * The test wallet's balances change whenever it is used, so nothing here hardcodes an amount. Instead
 * the same wallet is read twice: once through Maschina's reader, and once with a plain JSON-RPC request,
 * which is the same answer a block explorer shows. Any difference means our reading is wrong.
 */

import {
	balanceOf,
	mintsHeld,
	parseAddress,
	readBalances,
	rpcBalanceReader,
	solanaRpc,
	spendableLamports,
} from "@maschina/solana";
import { describe, expect, it } from "vitest";

const DEVNET = process.env["SOLANA_DEVNET_RPC_URL"] ?? "https://api.devnet.solana.com";

/** The devnet test wallet. Its address is public, and it only ever holds devnet funds. */
const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/** The chain asked directly, with no Maschina code in the way. */
async function rawCall(method: string, params: unknown[]): Promise<unknown> {
	const response = await fetch(DEVNET, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	const body = (await response.json()) as { result?: { value?: unknown } };
	return body.result?.value;
}

describe("a real wallet on devnet", () => {
	it("reports the same SOL balance the chain reports directly", async () => {
		const reader = rpcBalanceReader(solanaRpc(DEVNET));

		const [balances, raw] = await Promise.all([
			readBalances(reader, WALLET),
			rawCall("getBalance", [WALLET]),
		]);

		expect(balances.lamports).toBe(BigInt(raw as number));
		expect(balances.lamports).toBeGreaterThan(0n);
		expect(spendableLamports(balances)).toBeLessThan(balances.lamports);
	});

	it("reports the same token balances the chain reports directly", async () => {
		const reader = rpcBalanceReader(solanaRpc(DEVNET));
		const balances = await readBalances(reader, WALLET);

		const raw = (await rawCall("getTokenAccountsByOwner", [
			WALLET,
			{ programId: TOKEN_PROGRAM },
			{ encoding: "jsonParsed" },
		])) as {
			pubkey: string;
			account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } };
		}[];

		expect(raw.length).toBeGreaterThan(0);
		for (const account of raw) {
			const held = balances.tokens.find((token) => token.account === account.pubkey);
			expect(held).toBeDefined();
			expect(held?.amount).toBe(BigInt(account.account.data.parsed.info.tokenAmount.amount));
			expect(held?.mint).toBe(account.account.data.parsed.info.mint);
		}

		// Every mint the chain says it holds, Maschina says it holds.
		const rawMints = new Set(raw.map((account) => account.account.data.parsed.info.mint));
		for (const mint of mintsHeld(balances)) expect(rawMints.has(mint)).toBe(true);
	});

	it("is zero for a token this wallet has never held", async () => {
		const reader = rpcBalanceReader(solanaRpc(DEVNET));
		const balances = await readBalances(reader, WALLET);

		expect(balanceOf(balances, parseAddress("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"))).toBe(
			0n,
		);
	});

	it("reads an empty wallet as empty rather than failing", async () => {
		const reader = rpcBalanceReader(solanaRpc(DEVNET));
		const balances = await readBalances(
			reader,
			parseAddress("BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n"),
		);

		expect(balances.lamports).toBe(0n);
		expect(balances.tokens).toEqual([]);
		expect(spendableLamports(balances)).toBe(0n);
	});
});
