import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { rpcAccountReader, type SolanaRpc } from "./rpc.ts";

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
