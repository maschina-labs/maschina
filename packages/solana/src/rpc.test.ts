import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import {
	rpcAccountReader,
	rpcBalanceReader,
	rpcBlockhashReader,
	rpcConfirmationReader,
	rpcFeeReader,
	type SolanaRpc,
} from "./rpc.ts";

const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SIGNATURE_ACCOUNT = parseAddress("So11111111111111111111111111111111111111112");

/** An RPC node that answers with whatever the test hands it. */
const fakeRpc = (value: unknown): SolanaRpc =>
	({
		getAccountInfo: () => ({ send: async () => ({ value }) }),
	}) as unknown as SolanaRpc;

describe("reading accounts through an RPC node", () => {
	it("returns the owner and the parsed data", async () => {
		const reader = rpcAccountReader(fakeRpc({ owner: "owner", data: { parsed: true } }));

		expect(await reader.read(USDC)).toEqual({ owner: "owner", data: { parsed: true } });
	});

	it("returns nothing when the account does not exist", async () => {
		const reader = rpcAccountReader(fakeRpc(null));

		expect(await reader.read(USDC)).toBeUndefined();
	});
});

/** An RPC node with balances and token accounts, recording which programs were asked about. */
function fakeBalanceRpc(lamports: bigint, accountsByProgram: Record<string, unknown[]>) {
	const asked: string[] = [];
	const rpc = {
		getBalance: () => ({ send: async () => ({ value: lamports }) }),
		getTokenAccountsByOwner: (_owner: unknown, filter: { programId: string }) => {
			asked.push(filter.programId);
			return { send: async () => ({ value: accountsByProgram[filter.programId] ?? [] }) };
		},
	} as unknown as SolanaRpc;
	return { rpc, asked };
}

describe("reading balances through an RPC node", () => {
	const account = (pubkey: string, owner: string) => ({
		pubkey,
		account: { owner, data: { parsed: { type: "account" } } },
	});

	it("reads the SOL balance as a whole number", async () => {
		const { rpc } = fakeBalanceRpc(2_000_000_000n, {});

		expect(await rpcBalanceReader(rpc).lamportsOf(USDC)).toBe(2_000_000_000n);
	});

	it("asks both token programs, so no balance is missed", async () => {
		const legacy = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
		const token2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
		const { rpc, asked } = fakeBalanceRpc(0n, {
			[legacy]: [account("one", legacy)],
			[token2022]: [account("two", token2022)],
		});

		const accounts = await rpcBalanceReader(rpc).tokenAccountsOf(USDC);

		expect(asked).toEqual([legacy, token2022]);
		expect(accounts.map((entry) => entry.address)).toEqual(["one", "two"]);
		expect(accounts[0]?.owner).toBe(legacy);
	});
});

describe("reading confirmations through an RPC node", () => {
	const SIGNATURE =
		"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X";

	/** An RPC node that answers with one status and a height, recording what it was asked. */
	function fakeStatusRpc(status: unknown, height = 500n) {
		let searchedHistory: boolean | undefined;
		const rpc = {
			getSignatureStatuses: (
				_signatures: unknown,
				config: { searchTransactionHistory: boolean },
			) => {
				searchedHistory = config.searchTransactionHistory;
				return { send: async () => ({ value: [status] }) };
			},
			getBlockHeight: () => ({ send: async () => height }),
		} as unknown as SolanaRpc;
		return {
			rpc,
			get searchedHistory() {
				return searchedHistory;
			},
		};
	}

	it("reads a settled status", async () => {
		const fake = fakeStatusRpc({ slot: 499_906_176, confirmationStatus: "finalized", err: null });

		expect(await rpcConfirmationReader(fake.rpc).statusOf(SIGNATURE, true)).toEqual({
			slot: 499_906_176n,
			commitment: "finalized",
		});
		expect(fake.searchedHistory).toBe(true);
	});

	it("keeps the chain's own description of a failure", async () => {
		const fake = fakeStatusRpc({
			slot: 1n,
			confirmationStatus: "confirmed",
			err: { InstructionError: [3, "Custom"] },
		});

		expect(await rpcConfirmationReader(fake.rpc).statusOf(SIGNATURE, false)).toMatchObject({
			error: '{"InstructionError":[3,"Custom"]}',
		});
		expect(fake.searchedHistory).toBe(false);
	});

	it("treats a status with no commitment as barely processed", async () => {
		const fake = fakeStatusRpc({ slot: 2n, err: null });

		expect(await rpcConfirmationReader(fake.rpc).statusOf(SIGNATURE, false)).toMatchObject({
			commitment: "processed",
		});
	});

	it("returns nothing when the node has no record of the signature", async () => {
		const fake = fakeStatusRpc(null);

		expect(await rpcConfirmationReader(fake.rpc).statusOf(SIGNATURE, false)).toBeUndefined();
	});

	it("reads the block height as a whole number", async () => {
		const fake = fakeStatusRpc(null, 448_029_451n);

		expect(await rpcConfirmationReader(fake.rpc).blockHeight()).toBe(448_029_451n);
	});
});

describe("reading what recent transactions paid", () => {
	it("reads fees as whole numbers", async () => {
		const rpc = {
			getRecentPrioritizationFees: () => ({
				send: async () => [
					{ slot: 448_029_451, prioritizationFee: 0 },
					{ slot: 448_029_452, prioritizationFee: 12_345 },
				],
			}),
		} as unknown as SolanaRpc;

		expect(await rpcFeeReader(rpc).recentFees([USDC])).toEqual([
			{ slot: 448_029_451n, microLamports: 0n },
			{ slot: 448_029_452n, microLamports: 12_345n },
		]);
	});

	it("asks about the accounts it was given", async () => {
		let asked: unknown;
		const rpc = {
			getRecentPrioritizationFees: (accounts: unknown) => {
				asked = accounts;
				return { send: async () => [] };
			},
		} as unknown as SolanaRpc;

		await rpcFeeReader(rpc).recentFees([USDC, SIGNATURE_ACCOUNT]);

		expect(asked).toEqual([USDC, SIGNATURE_ACCOUNT]);
	});
});

describe("reading a recent blockhash", () => {
	const answer = (value: unknown) =>
		({ getLatestBlockhash: () => ({ send: async () => ({ value }) }) }) as unknown as SolanaRpc;

	it("gives the blockhash and the height after which it can never land", async () => {
		const reader = rpcBlockhashReader(
			answer({
				blockhash: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
				lastValidBlockHeight: 426_070_577n,
			}),
		);

		expect(await reader.latest()).toEqual({
			blockhash: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
			lastValidBlockHeight: 426_070_577n,
		});
	});

	it("asks for a blockhash nothing has confirmed yet, because the transaction has to outlive it", async () => {
		let asked: unknown;
		const rpc = {
			getLatestBlockhash: (options: unknown) => {
				asked = options;
				return { send: async () => ({ value: { blockhash: "x", lastValidBlockHeight: 1n } }) };
			},
		} as unknown as SolanaRpc;

		await rpcBlockhashReader(rpc).latest();

		expect(asked).toEqual({ commitment: "confirmed" });
	});

	it("refuses an answer with no blockhash in it, rather than building on nothing", async () => {
		await expect(rpcBlockhashReader(answer(null)).latest()).rejects.toThrow(/blockhash/);
	});
});
