import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import {
	type BalanceReader,
	balanceOf,
	type FetchedTokenAccount,
	mintsHeld,
	parseTokenAccount,
	readBalances,
	spendableLamports,
	WALLET_RENT_EXEMPT_LAMPORTS,
	type WalletBalances,
} from "./balances.ts";

const WALLET = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const OTHER_WALLET = parseAddress("11111111111111111111111111111111");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SOL = parseAddress("So11111111111111111111111111111111111111112");
const ACCOUNT = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const SECOND_ACCOUNT = "BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const tokenAccount = (
	over: {
		address?: string;
		owner?: string;
		mint?: unknown;
		holder?: unknown;
		amount?: unknown;
		decimals?: unknown;
		state?: string;
		type?: string;
		tokenAmount?: unknown;
	} = {},
): FetchedTokenAccount => ({
	address: over.address ?? ACCOUNT,
	owner: over.owner ?? TOKEN_PROGRAM,
	data: {
		parsed: {
			type: over.type ?? "account",
			info: {
				mint: "mint" in over ? over.mint : USDC,
				owner: "holder" in over ? over.holder : WALLET,
				state: over.state ?? "initialized",
				tokenAmount:
					"tokenAmount" in over
						? over.tokenAmount
						: {
								amount: over.amount ?? "20000000",
								decimals: over.decimals ?? 6,
								// An RPC also sends these. They are floating point, and deliberately ignored.
								uiAmount: 20.000000000000004,
								uiAmountString: "20",
							},
			},
		},
		program: "spl-token",
		space: 165,
	},
});

const balances = (over: Partial<WalletBalances> = {}): WalletBalances => ({
	wallet: WALLET,
	lamports: 0n as WalletBalances["lamports"],
	tokens: [],
	...over,
});

describe("reading a token account", () => {
	it("takes the exact amount and ignores the convenient decimal", () => {
		const token = parseTokenAccount(tokenAccount());

		expect(token.amount).toBe(20_000_000n);
		expect(token.decimals).toBe(6);
		expect(token.mint).toBe(USDC);
		expect(token.frozen).toBe(false);
	});

	it("notices a frozen account, which cannot be sold", () => {
		expect(parseTokenAccount(tokenAccount({ state: "frozen" })).frozen).toBe(true);
	});

	it.each([
		["an account owned by another program", { owner: "11111111111111111111111111111111" }],
		["a mint rather than a token account", { type: "mint" }],
		["no balance at all", { tokenAmount: undefined }],
		["an amount that is not a whole number", { amount: "2.5" }],
		["an amount held as a number", { amount: 20 }],
		["impossible decimals", { decimals: 42 }],
		["decimals that are not whole", { decimals: 1.5 }],
		["a mint that is not text", { mint: undefined }],
		["a holder that is not text", { holder: 7 }],
		["a mint that is not an address", { mint: "not-an-address" }],
	])("refuses %s", (_name, over) => {
		expect(() => parseTokenAccount(tokenAccount(over as never))).toThrow(MaschinaError);
	});
});

/** A chain that answers with whatever the test sets up. */
const fakeReader = (lamports: bigint, accounts: FetchedTokenAccount[]): BalanceReader => ({
	lamportsOf: async () => lamports,
	tokenAccountsOf: async () => accounts,
});

describe("reading a wallet", () => {
	it("reads SOL and tokens together", async () => {
		const wallet = await readBalances(fakeReader(2_000_000_000n, [tokenAccount()]), WALLET);

		expect(wallet.lamports).toBe(2_000_000_000n);
		expect(wallet.tokens).toHaveLength(1);
		expect(balanceOf(wallet, USDC)).toBe(20_000_000n);
	});

	it("refuses a token account belonging to someone else", async () => {
		const reader = fakeReader(0n, [tokenAccount({ holder: OTHER_WALLET })]);

		await expect(readBalances(reader, WALLET)).rejects.toThrow(/another wallet/);
	});

	it("adds up two accounts holding the same token", () => {
		const wallet = balances({
			tokens: [
				parseTokenAccount(tokenAccount({ amount: "1000000" })),
				parseTokenAccount(tokenAccount({ address: SECOND_ACCOUNT, amount: "500000" })),
			],
		});

		expect(balanceOf(wallet, USDC)).toBe(1_500_000n);
	});

	it("does not count frozen tokens, which cannot be sold", () => {
		const wallet = balances({
			tokens: [
				parseTokenAccount(tokenAccount({ amount: "1000000" })),
				parseTokenAccount(
					tokenAccount({ address: SECOND_ACCOUNT, amount: "9000000", state: "frozen" }),
				),
			],
		});

		expect(balanceOf(wallet, USDC)).toBe(1_000_000n);
	});

	it("is zero for a token the wallet has never held", () => {
		expect(balanceOf(balances(), SOL)).toBe(0n);
	});

	it("lists the mints actually held, once each", () => {
		const wallet = balances({
			tokens: [
				parseTokenAccount(tokenAccount({ amount: "1" })),
				parseTokenAccount(tokenAccount({ address: SECOND_ACCOUNT, amount: "2" })),
				parseTokenAccount(tokenAccount({ address: SECOND_ACCOUNT, mint: SOL, amount: "0" })),
			],
		});

		expect(mintsHeld(wallet)).toEqual([USDC]);
	});
});

describe("what can actually be spent", () => {
	it("keeps back the rent minimum, or the account is closed", () => {
		const wallet = balances({ lamports: 1_000_000_000n as WalletBalances["lamports"] });

		expect(spendableLamports(wallet)).toBe(1_000_000_000n - WALLET_RENT_EXEMPT_LAMPORTS);
	});

	it("keeps back a fee reserve as well", () => {
		const wallet = balances({ lamports: 1_000_000_000n as WalletBalances["lamports"] });

		expect(spendableLamports(wallet, 5_000_000n)).toBe(
			1_000_000_000n - WALLET_RENT_EXEMPT_LAMPORTS - 5_000_000n,
		);
	});

	it("is zero, never negative, when the wallet is nearly empty", () => {
		expect(spendableLamports(balances({ lamports: 1000n as WalletBalances["lamports"] }))).toBe(0n);
		expect(spendableLamports(balances({ lamports: WALLET_RENT_EXEMPT_LAMPORTS as never }))).toBe(
			0n,
		);
	});

	it("refuses a negative reserve", () => {
		expect(() => spendableLamports(balances(), -1n)).toThrow(MaschinaError);
	});
});
