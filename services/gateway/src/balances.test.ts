import type { BalanceReader } from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { machineBalances } from "./balances.ts";

const WALLET = "6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy";
const VAULT = "6JTAb5osNxiz9qr9qNnKrwz2qwJ6frahvKfKJZxJMwFk";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

const account = (
	address: string,
	holder: string,
	mint: string,
	amount: string,
	state = "initialized",
) => ({
	address,
	owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
	lamports: 2_039_280n,
	executable: false,
	data: {
		parsed: {
			type: "account",
			info: {
				mint,
				owner: holder,
				state,
				tokenAmount: { amount, decimals: mint === USDC ? 6 : 9 },
			},
		},
		program: "spl-token",
		space: 165,
	},
});

/** A chain where the wallet holds SOL, a little USDC and a frozen account, and the vault holds USDC. */
const reader: BalanceReader = {
	lamportsOf: async (wallet) => (String(wallet) === WALLET ? 12_000_000n : 1_000_000n),
	tokenAccountsOf: async (wallet) =>
		(String(wallet) === WALLET
			? [
					account("5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", WALLET, USDC, "250000"),
					account("BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n", WALLET, SOL, "5", "frozen"),
				]
			: [account("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF", VAULT, USDC, "1010000")]) as never,
};

describe("what a machine holds", () => {
	it("reads its wallet and its vault, and leaves out what is frozen", async () => {
		expect(await machineBalances(reader, { walletAddress: WALLET, vaultAddress: VAULT })).toEqual({
			wallet: {
				address: WALLET,
				lamports: "12000000",
				tokens: [{ mint: USDC, amount: "250000", decimals: 6 }],
			},
			vault: {
				address: VAULT,
				lamports: "1000000",
				tokens: [{ mint: USDC, amount: "1010000", decimals: 6 }],
			},
		});
	});

	it("has no vault for a machine made before vaults existed", async () => {
		const read = await machineBalances(reader, { walletAddress: WALLET });
		expect("vault" in read).toBe(false);
	});
});
