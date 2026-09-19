import { describe, expect, it } from "vitest";
import type { SolanaRpc } from "./rpc.ts";
import {
	balanceChangesOf,
	type LandedTransaction,
	rpcTransactionReader,
	tradeCostOf,
} from "./trade-cost.ts";

const WALLET = "WaLLet1111111111111111111111111111111111111";
const POOL = "Poo11111111111111111111111111111111111111111";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** A SOL to USDC swap where SOL was wrapped and unwrapped inside the transaction. */
const solToUsdc: LandedTransaction = {
	fee: 15_000n,
	accountKeys: [WALLET, POOL],
	preBalances: [1_000_000_000n, 5_000_000_000n],
	// The wallet paid 100_000_000 for the trade and 15_000 in fees.
	postBalances: [899_985_000n, 5_100_000_000n],
	preTokenBalances: [{ mint: USDC, owner: WALLET, amount: 2_000_000n }],
	postTokenBalances: [{ mint: USDC, owner: WALLET, amount: 16_523_000n }],
};

describe("balanceChangesOf", () => {
	it("counts native SOL and wrapped SOL together, with the fee taken out", () => {
		const changes = balanceChangesOf(solToUsdc, WALLET);
		expect(changes.get(SOL)).toBe(-100_000_000n);
		expect(changes.get(USDC)).toBe(14_523_000n);
	});

	it("only counts token accounts the wallet owns", () => {
		const changes = balanceChangesOf(
			{
				...solToUsdc,
				preTokenBalances: [...solToUsdc.preTokenBalances, { mint: USDC, owner: POOL, amount: 9n }],
				postTokenBalances: [
					...solToUsdc.postTokenBalances,
					{ mint: USDC, owner: POOL, amount: 1n },
				],
			},
			WALLET,
		);
		expect(changes.get(USDC)).toBe(14_523_000n);
	});

	it("counts a token account the trade opened, which has no balance before", () => {
		const changes = balanceChangesOf({ ...solToUsdc, preTokenBalances: [] }, WALLET);
		expect(changes.get(USDC)).toBe(16_523_000n);
	});

	it("adds wrapped SOL held in a token account to the native change", () => {
		const changes = balanceChangesOf(
			{
				...solToUsdc,
				preTokenBalances: [{ mint: SOL, owner: WALLET, amount: 50n }],
				postTokenBalances: [{ mint: SOL, owner: WALLET, amount: 80n }],
			},
			WALLET,
		);
		expect(changes.get(SOL)).toBe(-100_000_000n + 30n);
	});
});

describe("tradeCostOf", () => {
	it("reads what was spent, what came back and the fee", () => {
		expect(tradeCostOf(solToUsdc, WALLET, { inputMint: SOL, outputMint: USDC })).toEqual({
			inputAmount: 100_000_000n,
			outputAmount: 14_523_000n,
			feeLamports: 15_000n,
		});
	});

	it("refuses a transaction the wallet is not part of", () => {
		expect(() =>
			tradeCostOf(solToUsdc, "Stranger11111111111111111111111111111111111", {
				inputMint: SOL,
				outputMint: USDC,
			}),
		).toThrow(/not in this transaction/);
	});

	it("refuses a transaction that failed on chain", () => {
		expect(() =>
			tradeCostOf({ ...solToUsdc, failed: "slippage" }, WALLET, {
				inputMint: SOL,
				outputMint: USDC,
			}),
		).toThrow(/failed on chain/);
	});

	it("never reports a negative amount", () => {
		const nothingMoved = { ...solToUsdc, postBalances: [999_985_000n, 5_000_000_000n] };
		const cost = tradeCostOf(
			{ ...nothingMoved, postTokenBalances: solToUsdc.preTokenBalances },
			WALLET,
			{ inputMint: SOL, outputMint: USDC },
		);
		expect(cost).toEqual({ inputAmount: 0n, outputAmount: 0n, feeLamports: 15_000n });
	});
});

/** An RPC client that answers getTransaction with whatever it was given. */
const rpcAnswering = (answer: unknown) =>
	({ getTransaction: () => ({ send: async () => answer }) }) as unknown as SolanaRpc;

describe("rpcTransactionReader", () => {
	it("turns the node's answer into amounts", async () => {
		const reader = rpcTransactionReader(
			rpcAnswering({
				transaction: { message: { accountKeys: [{ pubkey: WALLET }, { pubkey: POOL }] } },
				meta: {
					fee: 5000,
					err: null,
					preBalances: [10, 20],
					postBalances: [5, 25],
					preTokenBalances: [{ mint: USDC, owner: WALLET, uiTokenAmount: { amount: "7" } }],
					postTokenBalances: [{ mint: USDC, owner: WALLET, uiTokenAmount: { amount: "9" } }],
				},
			}),
		);

		expect(await reader.transactionOf("sig")).toEqual({
			fee: 5000n,
			accountKeys: [WALLET, POOL],
			preBalances: [10n, 20n],
			postBalances: [5n, 25n],
			preTokenBalances: [{ mint: USDC, owner: WALLET, amount: 7n }],
			postTokenBalances: [{ mint: USDC, owner: WALLET, amount: 9n }],
		});
	});

	it("keeps why a transaction failed, and tolerates missing token balances", async () => {
		const reader = rpcTransactionReader(
			rpcAnswering({
				transaction: { message: { accountKeys: [{ pubkey: WALLET }] } },
				meta: {
					fee: 5000,
					err: { InstructionError: [2, { Custom: 6001n }] },
					preBalances: [1],
					postBalances: [1],
				},
			}),
		);
		const landed = await reader.transactionOf("sig");
		expect(landed?.failed).toContain("6001");
		expect(landed?.preTokenBalances).toEqual([]);
	});

	it("says nothing when the node has no such transaction", async () => {
		expect(await rpcTransactionReader(rpcAnswering(null)).transactionOf("sig")).toBeUndefined();
	});
});
