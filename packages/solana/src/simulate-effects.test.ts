import { describe, expect, it, vi } from "vitest";
import { parseAddress } from "./address.ts";
import type { FetchedTokenAccount } from "./balances.ts";
import { type SimulationPorts, simulateEffects } from "./simulate-effects.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const USDC_ACCOUNT = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const SOL_ACCOUNT = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const STRANGER = "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TRANSACTION = new Uint8Array([1, 2, 3]);

/** A token account the way an RPC returns it with jsonParsed encoding. */
const account = (address: string, mint: string, amount: string): FetchedTokenAccount => ({
	address,
	owner: TOKEN_PROGRAM,
	data: {
		parsed: {
			type: "account",
			info: {
				mint,
				owner: WALLET,
				state: "initialized",
				tokenAmount: { amount, decimals: mint === SOL ? 9 : 6 },
			},
		},
	},
});

function ports(over: Partial<SimulationPorts> = {}): SimulationPorts {
	return {
		balances: {
			lamportsOf: async () => 1_000_000_000n,
			tokenAccountsOf: async () => [account(USDC_ACCOUNT, USDC, "50000000")],
		},
		simulate: async () => ({
			ok: true,
			lamports: 995_000_000n,
			accounts: [account(USDC_ACCOUNT, USDC, "9650000"), account(SOL_ACCOUNT, SOL, "339000000")],
		}),
		...over,
	};
}

const asking = {
	transaction: TRANSACTION,
	wallet: parseAddress(WALLET),
	mints: [USDC, SOL],
};

describe("measuring a transaction against the chain", () => {
	it("reports what the wallet lost and gained", async () => {
		const result = await simulateEffects(ports(), asking);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.lamports).toBe(-5_000_000n);
		expect(result.value.tokens).toContainEqual({ mint: USDC, delta: -40_350_000n });
		expect(result.value.tokens).toContainEqual({ mint: SOL, delta: 339_000_000n });
	});

	it("watches the accounts a token would land in even when they do not exist yet", async () => {
		// The first buy of a token creates its account during the transaction, so it is absent from
		// the wallet's current accounts. Asking only about what exists would miss the whole gain.
		const watched: string[][] = [];
		await simulateEffects(
			ports({
				simulate: async (_transaction, _wallet, addresses) => {
					watched.push([...addresses]);
					return { ok: true, lamports: 0n, accounts: [] };
				},
			}),
			asking,
		);

		const addresses = watched[0] ?? [];
		expect(addresses).toContain(WALLET);
		expect(addresses).toContain(USDC_ACCOUNT);
		// Two token programs exist, so each mint contributes two possible accounts.
		expect(addresses.length).toBeGreaterThanOrEqual(5);
	});

	it("asks about each account once, however many times it is named", async () => {
		const watched: string[][] = [];
		await simulateEffects(
			ports({
				simulate: async (_transaction, _wallet, addresses) => {
					watched.push([...addresses]);
					return { ok: true, lamports: 0n, accounts: [] };
				},
			}),
			{ ...asking, mints: [USDC, USDC, SOL] },
		);

		const addresses = watched[0] ?? [];
		expect(new Set(addresses).size).toBe(addresses.length);
	});

	it("refuses when the transaction would fail on chain", async () => {
		const result = await simulateEffects(
			ports({ simulate: async () => ({ ok: false, problem: "insufficient funds" }) }),
			asking,
		);

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.message).toMatch(/insufficient funds/);
	});

	it("refuses when the chain cannot be reached, rather than signing unverified", async () => {
		// Failing closed costs trades during an outage. The other way round signs unmeasured
		// transactions during exactly the window somebody would choose.
		const result = await simulateEffects(
			ports({
				simulate: async () => {
					throw new Error("socket hang up");
				},
			}),
			asking,
		);

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe("unavailable");
	});

	it("refuses when the wallet cannot be read either", async () => {
		const result = await simulateEffects(
			ports({
				balances: {
					lamportsOf: async () => {
						throw new Error("socket hang up");
					},
					tokenAccountsOf: async () => [],
				},
			}),
			asking,
		);

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe("unavailable");
	});

	it("reads the wallet and builds the watch list before simulating, not after", async () => {
		// The before-reading has to happen first or the comparison is against the wrong state.
		const order: string[] = [];
		await simulateEffects(
			ports({
				balances: {
					lamportsOf: async () => {
						order.push("read");
						return 0n;
					},
					tokenAccountsOf: async () => {
						order.push("read");
						return [];
					},
				},
				simulate: async () => {
					order.push("simulate");
					return { ok: true, lamports: 0n, accounts: [] };
				},
			}),
			asking,
		);

		expect(order.indexOf("simulate")).toBe(order.length - 1);
	});

	it("ignores an account the simulation returns that belongs to somebody else", async () => {
		// A node answering with a stranger's account would otherwise invent a balance change.
		const theirs = account(STRANGER, USDC, "999000000");
		(theirs.data as { parsed: { info: { owner: string } } }).parsed.info.owner = STRANGER;

		const result = await simulateEffects(
			ports({ simulate: async () => ({ ok: true, lamports: 1_000_000_000n, accounts: [theirs] }) }),
			asking,
		);

		expect(result.ok).toBe(true);
		// The wallet's own USDC is unaccounted for afterwards, so it reads as having left.
		if (!result.ok) return;
		expect(result.value.tokens).toEqual([{ mint: USDC, delta: -50_000_000n }]);
	});

	it("passes the exact bytes it was given to the simulation", async () => {
		const seen: Uint8Array[] = [];
		const simulate = vi.fn(async (transaction: Uint8Array) => {
			seen.push(transaction);
			return { ok: true as const, lamports: 0n, accounts: [] };
		});

		await simulateEffects(ports({ simulate }), asking);

		expect(seen[0]).toBe(TRANSACTION);
	});
});
