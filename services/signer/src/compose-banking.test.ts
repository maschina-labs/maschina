import { newId } from "@maschina/core";
import { sweepDue } from "@maschina/rules";
import { parseAddress, type SolanaRpc, tokenAccountFor } from "@maschina/solana";
import { describe, expect, it, vi } from "vitest";
import { everythingWithdrawer, sweeper } from "./compose.ts";

const TRADING = parseAddress("3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF");
const VAULT = parseAddress("CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt");
const OWNER = parseAddress("G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const BLOCKHASH = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

/** Fills in the signature a provider would have written, so the bytes read back as signed. */
function signedLike(transaction: Uint8Array): Uint8Array {
	const signed = new Uint8Array(transaction);
	signed.fill(7, 1, 65);
	return signed;
}

/** A token account as a node returns it, parsed. */
const tokenAccount = async (owner: string, amount: bigint) => ({
	pubkey: await tokenAccountFor({ owner, mint: USDC }),
	account: {
		owner: TOKEN,
		data: {
			parsed: {
				type: "account",
				info: {
					mint: USDC,
					owner,
					state: "initialized",
					tokenAmount: { amount: amount.toString(), decimals: 6 },
				},
			},
		},
	},
});

/**
 * An RPC node that answers what banking and withdrawing ask it: balances, a mint, a blockhash, sending,
 * confirming and reading back. What each account holds is given per test.
 *
 * The point of testing the wiring rather than only the flows: a port connected to the wrong thing loses
 * money, and nothing in the flows' own tests would notice.
 */
async function fakeRpc(holding: { trading: bigint; vault: bigint; lamports: bigint }) {
	const sent: string[] = [];
	const accounts: Record<string, unknown[]> = {
		[TRADING]: holding.trading > 0n ? [await tokenAccount(TRADING, holding.trading)] : [],
		[VAULT]: holding.vault > 0n ? [await tokenAccount(VAULT, holding.vault)] : [],
	};
	const rpc = {
		getBalance: (address: string) => ({
			send: async () => ({ value: address === TRADING ? holding.lamports : 0n }),
		}),
		getTokenAccountsByOwner: (owner: string, filter: { programId: string }) => ({
			send: async () => ({ value: filter.programId === TOKEN ? (accounts[owner] ?? []) : [] }),
		}),
		getAccountInfo: () => ({
			send: async () => ({
				value: {
					owner: TOKEN,
					data: {
						parsed: {
							type: "mint",
							info: {
								isInitialized: true,
								decimals: 6,
								supply: "1000000000000",
								mintAuthority: null,
								freezeAuthority: null,
							},
						},
					},
				},
			}),
		}),
		getLatestBlockhash: () => ({
			send: async () => ({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 426_070_577n } }),
		}),
		sendTransaction: (encoded: string) => ({
			send: async () => {
				sent.push(encoded);
				return "5".repeat(88);
			},
		}),
		getSignatureStatuses: () => ({
			send: async () => ({
				value: [{ confirmationStatus: "confirmed", err: null, slot: 426_070_000n }],
			}),
		}),
		getTransaction: () => ({
			send: async () => ({
				slot: 426_070_000n,
				meta: { fee: 5_000n, err: null, preBalances: [], postBalances: [] },
				transaction: { message: { accountKeys: [] } },
			}),
		}),
	} as unknown as SolanaRpc;
	return { rpc, sent };
}

const signer = () =>
	vi.fn(async (_walletId: string, transaction: Uint8Array, _account?: string) => ({
		ok: true as const,
		value: signedLike(transaction),
	}));

describe("the sweeper, wired to its real parts", () => {
	it("reads what the machine holds from the chain, and banks the surplus once", async () => {
		const { rpc, sent } = await fakeRpc({ trading: 51_500_000n, vault: 0n, lamports: 20_000_000n });
		const written: string[] = [];
		const sign = signer();

		const answer = await sweeper({
			record: {
				machineFor: async () => ({
					wallet: TRADING,
					vault: VAULT,
					providerWalletId: "wallet-9f2c",
					budgetMint: USDC,
					paper: false,
				}),
				floatOf: async (_machineId, holding) => ({
					target: 50_000_000n,
					value: holding,
					sweep: sweepDue({ target: 50_000_000n, value: holding, flat: true }),
				}),
				record: async (event) => {
					written.push(event.type);
				},
				submissionFor: async () => undefined,
				requestedFor: async () => undefined,
			},
			provider: { sign } as never,
			rpc,
		}).sweep({ sweepId: newId<"sweep">(), machineId: newId<"machine">() });

		expect(answer).toMatchObject({ status: "swept", amount: "1500000", to: VAULT });
		expect(sent).toHaveLength(1);
		expect(written).toEqual(["sweep.requested", "sweep.submitted", "sweep.completed"]);
	});
});

describe("taking everything out, wired to its real parts", () => {
	it("empties the vault and the trading account, then sends the SOL, each signed by the right account", async () => {
		const { rpc, sent } = await fakeRpc({
			trading: 10_000_000n,
			vault: 1_500_000n,
			lamports: 20_000_000n,
		});
		const written: string[] = [];
		const sign = signer();
		const withdrawSol = vi.fn(async (request: { withdrawalId: string; lamports: string }) => ({
			status: "sent" as const,
			withdrawalId: request.withdrawalId,
			signature: "4".repeat(88),
			to: OWNER,
			lamports: request.lamports,
		}));

		const answer = await everythingWithdrawer({
			record: {
				machineFor: async () => ({
					wallet: TRADING,
					vault: VAULT,
					ownerWallet: OWNER,
					providerWalletId: "wallet-9f2c",
				}),
				record: async (event) => {
					written.push(event.type);
				},
				submissionFor: async () => undefined,
			},
			provider: { sign } as never,
			rpc,
			withdrawSol,
		}).withdrawEverything({ withdrawalId: newId<"withdrawal">(), machineId: newId<"machine">() });

		expect(answer).toMatchObject({ status: "sent", to: OWNER, lamports: "19995000" });
		// The vault's tokens need the trading account to pay and the vault to sign; the trading account's
		// need only itself.
		expect(sign.mock.calls.map((call) => call[2])).toEqual(["trading", "vault", "trading"]);
		expect(sent).toHaveLength(2);
		expect(withdrawSol).toHaveBeenCalledOnce();
		expect(written.filter((type) => type === "withdrawal.completed")).toHaveLength(2);
	});

	it("stops, and says so, when the provider will not sign", async () => {
		const { rpc, sent } = await fakeRpc({ trading: 10_000_000n, vault: 0n, lamports: 20_000_000n });
		const sign = vi.fn(async () => ({
			ok: false as const,
			error: { kind: "refused" as const, message: "no", retryable: false, details: {} },
		}));

		await expect(
			everythingWithdrawer({
				record: {
					machineFor: async () => ({ wallet: TRADING, ownerWallet: OWNER, providerWalletId: "w" }),
					record: async () => {},
					submissionFor: async () => undefined,
				},
				provider: { sign } as never,
				rpc,
				withdrawSol: async () => {
					throw new Error("the SOL must not be asked for when the tokens did not go");
				},
			}).withdrawEverything({ withdrawalId: newId<"withdrawal">(), machineId: newId<"machine">() }),
		).rejects.toThrow();
		expect(sent).toEqual([]);
	});
});
