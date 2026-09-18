import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { rpcAccountReader, rpcBalanceReader, type SolanaRpc } from "./rpc.ts";

const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

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
